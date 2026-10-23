"""Docker web controller.

Standard library only; drives the local `docker` CLI. Binds to 127.0.0.1 by
default: anyone who can reach this port controls Docker, which is effectively
root on the machine. Mutating requests need an `X-Requested-With` header (so a
web page on another origin cannot trigger them) and the Host header must be a
loopback name (blocks DNS rebinding).
"""

import argparse
import json
import re
import shutil
import subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

HERE = Path(__file__).resolve().parent

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,127}$")
REF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-/:@]{0,255}$")
PORT_RE = re.compile(r"^\d{1,5}:\d{1,5}(/(tcp|udp))?$")
ANON_VOLUME_RE = re.compile(r"^[0-9a-f]{64}$")

ACTIONS = {"start", "stop", "restart", "pause", "unpause", "kill", "rm"}
BUILTIN_NETWORKS = {"bridge", "host", "none"}
PRUNES = {
    "containers": ["container", "prune", "-f"],
    "images": ["image", "prune", "-f"],
    "images-all": ["image", "prune", "-a", "-f"],
    "volumes": ["volume", "prune", "-f"],
    "volumes-all": ["volume", "prune", "-a", "-f"],
    "builder": ["builder", "prune", "-a", "-f"],
    "system": ["system", "prune", "-a", "-f"],
}
REQUIRED_HEADER = ("X-Requested-With", "docker-webui")
MAX_BODY = 64 * 1024


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def run_docker(args, timeout=60):
    try:
        proc = subprocess.run(
            ["docker", *args], capture_output=True, text=True, timeout=timeout
        )
    except FileNotFoundError:
        raise ApiError(503, "docker command not found")
    except subprocess.TimeoutExpired:
        raise ApiError(504, "docker command timed out")
    return proc.returncode, proc.stdout, proc.stderr


def docker_ok(args, timeout=60):
    code, out, err = run_docker(args, timeout)
    if code != 0:
        raise ApiError(500, err.strip() or "docker command failed")
    return out


def docker_json_lines(args):
    out = docker_ok(args)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def df_verbose():
    out = docker_ok(["system", "df", "-v", "--format", "json"])
    return json.loads(out)


def first_size(text):
    """'4.1kB (virtual 9.11MB)' -> '4.1kB'."""
    return (text or "").split(" ")[0]


def image_name(img):
    if img.get("Repository") in (None, "", "<none>"):
        return img.get("ID", "").replace("sha256:", "")[:12]
    return "%s:%s" % (img["Repository"], img.get("Tag", "latest"))


def cleanup_candidates():
    """What each prune kind would remove, computed from one `df -v` call."""
    verbose = df_verbose()

    containers = []
    for c in verbose.get("Containers") or []:
        if not str(c.get("Status", "")).startswith("Up"):
            containers.append({
                "type": "container",
                "name": c.get("Names", ""),
                "detail": c.get("Image", ""),
                "size": first_size(c.get("Size")),
            })

    dangling, unused_images = [], []
    for img in verbose.get("Images") or []:
        if str(img.get("Containers", "0")) != "0":
            continue
        item = {
            "type": "image",
            "name": image_name(img),
            "detail": img.get("CreatedSince", ""),
            "size": img.get("UniqueSize") or img.get("Size", ""),
        }
        unused_images.append(item)
        if img.get("Repository") in (None, "", "<none>"):
            dangling.append(item)

    anon_volumes, all_volumes = [], []
    for v in verbose.get("Volumes") or []:
        if str(v.get("Links", "0")) != "0":
            continue
        item = {
            "type": "volume",
            "name": v.get("Name", ""),
            "detail": "anonymous" if ANON_VOLUME_RE.match(v.get("Name", "")) else "named",
            "size": v.get("Size", ""),
        }
        all_volumes.append(item)
        if ANON_VOLUME_RE.match(v.get("Name", "")):
            anon_volumes.append(item)

    cache = []
    for e in verbose.get("BuildCache") or []:
        if str(e.get("InUse", "false")).lower() == "true":
            continue
        cache.append({
            "type": "cache",
            "name": (e.get("ID") or e.get("CacheID") or "")[:12],
            "detail": e.get("Description") or e.get("Type") or e.get("CacheType") or "",
            "size": e.get("Size", ""),
        })

    return {
        "containers": containers,
        "images": dangling,
        "images-all": unused_images,
        "volumes": anon_volumes,
        "volumes-all": all_volumes,
        "builder": cache,
        "system": containers + unused_images + cache,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "DockerWebUI/2.0"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    # ---- plumbing -------------------------------------------------------

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def check_host(self):
        host = self.headers.get("Host", "")
        name = host[: host.index("]") + 1] if host.startswith("[") else host.split(":")[0]
        if name.lower() not in self.server.allowed_hosts:
            raise ApiError(403, "host not allowed")

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "body too large")
        if not length:
            return {}
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            raise ApiError(400, "invalid json")
        if not isinstance(data, dict):
            raise ApiError(400, "json object expected")
        return data

    def dispatch(self, handler):
        try:
            self.check_host()
            handler()
        except ApiError as exc:
            self.send_json(exc.status, {"error": exc.message})
        except Exception as exc:  # keep the server alive on unexpected errors
            self.send_json(500, {"error": "internal error: %s" % exc})

    def do_GET(self):
        self.dispatch(self.route_get)

    def do_POST(self):
        self.dispatch(self.route_post)

    # ---- routing --------------------------------------------------------

    def route_get(self):
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        query = parse_qs(url.query)
        if url.path in ("/", "/index.html"):
            return self.serve_index()
        if parts[:1] != ["api"]:
            raise ApiError(404, "not found")
        if parts == ["api", "overview"]:
            return self.api_overview()
        if parts == ["api", "containers"]:
            return self.api_containers(query.get("all", ["1"])[0] == "1")
        if parts == ["api", "stats"]:
            return self.api_stats()
        if parts == ["api", "images"]:
            return self.send_json(200, df_verbose().get("Images") or [])
        if parts == ["api", "volumes"]:
            return self.api_volumes()
        if parts == ["api", "networks"]:
            return self.api_networks()
        if parts == ["api", "cleanup"]:
            return self.send_json(200, cleanup_candidates())
        if len(parts) == 4 and parts[1] == "containers" and parts[3] == "logs":
            return self.api_logs(parts[2], query.get("tail", ["200"])[0])
        raise ApiError(404, "not found")

    def route_post(self):
        if self.headers.get(REQUIRED_HEADER[0]) != REQUIRED_HEADER[1]:
            raise ApiError(403, "missing request header")
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if parts == ["api", "prune"]:
            return self.api_prune(self.read_json())
        if parts == ["api", "containers", "run"]:
            return self.api_run(self.read_json())
        if parts == ["api", "images", "pull"]:
            return self.api_pull(self.read_json())
        if parts == ["api", "images", "rm"]:
            return self.api_image_rm(self.read_json())
        if parts == ["api", "volumes", "rm"]:
            return self.api_volume_rm(self.read_json())
        if len(parts) == 4 and parts[:2] == ["api", "containers"]:
            return self.api_container_action(parts[2], parts[3])
        raise ApiError(404, "not found")

    # ---- read endpoints -------------------------------------------------

    def serve_index(self):
        body = (HERE / "index.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def api_overview(self):
        code, out, err = run_docker(["version", "--format", "{{.Server.Version}}"])
        if code != 0:
            raise ApiError(503, err.strip() or "docker is not reachable")
        containers = docker_json_lines(["ps", "-a", "--format", "{{json .}}"])
        usage = shutil.disk_usage("/")
        self.send_json(200, {
            "version": out.strip(),
            "df": docker_json_lines(["system", "df", "--format", "{{json .}}"]),
            "containers": {
                "total": len(containers),
                "running": sum(1 for c in containers if c.get("State") == "running"),
            },
            "disk": {"total": usage.total, "used": usage.used, "free": usage.free},
        })

    def api_containers(self, all_):
        args = ["ps", "--format", "{{json .}}", "--no-trunc"]
        if all_:
            args.insert(1, "-a")
        self.send_json(200, docker_json_lines(args))

    def api_stats(self):
        self.send_json(200, docker_json_lines(["stats", "--no-stream", "--format", "{{json .}}"]))

    def api_volumes(self):
        rows = []
        for v in df_verbose().get("Volumes") or []:
            name = v.get("Name", "")
            rows.append({
                "Name": name,
                "Driver": v.get("Driver", "local"),
                "Size": v.get("Size", ""),
                "Links": int(v.get("Links", 0) or 0),
                "Anonymous": bool(ANON_VOLUME_RE.match(name)),
            })
        self.send_json(200, rows)

    def api_networks(self):
        rows = docker_json_lines(["network", "ls", "--format", "{{json .}}"])
        for n in rows:
            n["Builtin"] = n.get("Name") in BUILTIN_NETWORKS
        self.send_json(200, rows)

    def api_logs(self, cid, tail):
        if not NAME_RE.match(cid):
            raise ApiError(400, "invalid container id")
        if not tail.isdigit() or int(tail) > 10000:
            raise ApiError(400, "tail must be 0..10000")
        code, out, err = run_docker(["logs", "--tail", tail, "--timestamps", cid])
        if code != 0:
            raise ApiError(500, err.strip() or "logs failed")
        self.send_json(200, {"logs": out + err})

    # ---- mutating endpoints ---------------------------------------------

    def api_container_action(self, cid, action):
        if not NAME_RE.match(cid):
            raise ApiError(400, "invalid container id")
        if action not in ACTIONS:
            raise ApiError(400, "unsupported action")
        args = [action] + (["-f"] if action == "rm" else []) + [cid]
        code, out, err = run_docker(args, timeout=120)
        if "No such container" in err:
            raise ApiError(404, "container not found")
        if code != 0:
            raise ApiError(500, err.strip() or "action failed")
        self.send_json(200, {"ok": True})

    def api_run(self, body):
        image = str(body.get("image", "")).strip()
        name = str(body.get("name", "")).strip()
        ports = body.get("ports") or []
        if not REF_RE.match(image):
            raise ApiError(400, "invalid image name")
        if name and not NAME_RE.match(name):
            raise ApiError(400, "invalid container name")
        if not isinstance(ports, list) or len(ports) > 20 or not all(
            isinstance(p, str) and PORT_RE.match(p) for p in ports
        ):
            raise ApiError(400, "ports must look like 8080:80")
        args = ["run", "-d"]
        if name:
            args += ["--name", name]
        for p in ports:
            args += ["-p", p]
        args.append(image)
        out = docker_ok(args, timeout=900)
        self.send_json(200, {"ok": True, "id": out.strip()[:12]})

    def api_pull(self, body):
        image = str(body.get("image", "")).strip()
        if not REF_RE.match(image):
            raise ApiError(400, "invalid image name")
        docker_ok(["pull", image], timeout=1800)
        self.send_json(200, {"ok": True})

    def api_image_rm(self, body):
        ref = str(body.get("ref", "")).strip()
        if not REF_RE.match(ref):
            raise ApiError(400, "invalid image reference")
        code, out, err = run_docker(["rmi", ref], timeout=120)
        if code != 0:
            raise ApiError(409, err.strip() or "could not remove image")
        self.send_json(200, {"ok": True})

    def api_volume_rm(self, body):
        name = str(body.get("name", "")).strip()
        if not NAME_RE.match(name):
            raise ApiError(400, "invalid volume name")
        code, out, err = run_docker(["volume", "rm", name], timeout=120)
        if code != 0:
            raise ApiError(409, err.strip() or "could not remove volume")
        self.send_json(200, {"ok": True})

    def api_prune(self, body):
        kind = body.get("kind")
        if kind not in PRUNES:
            raise ApiError(400, "unsupported prune kind")
        out = docker_ok(PRUNES[kind], timeout=900)
        match = re.search(r"Total reclaimed space:\s*(.+)", out)
        self.send_json(200, {
            "ok": True,
            "reclaimed": match.group(1).strip() if match else "0B",
        })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--allowed-host", action="append", default=[],
                        help="extra Host header name to accept (repeatable)")
    args = parser.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.allowed_hosts = {"127.0.0.1", "localhost", "[::1]"} | {h.lower() for h in args.allowed_host}
    print("Docker web UI on http://%s:%d" % (args.host, args.port))
    httpd.serve_forever()


if __name__ == "__main__":
    main()
