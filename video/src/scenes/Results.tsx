import React from "react";
import { useCurrentFrame } from "remotion";
import { Caption, Heading } from "../components/Bits";
import { DotPlot, StatCard, SuiteList } from "../components/StatCards";
import { values } from "../data";
import { enter, SAFE } from "../theme";
import { beats, type SceneProps } from "./util";

/** 9 การทดลองและผลลัพธ์: suites tick one by one, counts run up, then the speed numbers and the raw samples. */
export const Results: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const titles = beats(s, "title");
  const suites = beats(s, "suite");
  const stats = beats(s, "stat");
  const caps = beats(s, "caption");
  const perfTitle = titles[1];
  const phaseB = perfTitle ? enter(frame, perfTitle.f, 18) : 0;
  const perfStart = perfTitle?.f ?? Infinity;
  const testStats = stats.filter((b) => b.f < perfStart);
  const perfStats = stats.filter((b) => b.f >= perfStart);
  const big = testStats.find((b) => b.value?.key === "tests.unit_total");
  const small = testStats.filter((b) => b !== big && b.value?.key !== "tests.suites");
  const suitesCard = testStats.find((b) => b.value?.key === "tests.suites");
  const raw = (values["perf.bbox.samples"] as unknown as { value: number[] } | undefined)?.value ?? [];
  const median = values["perf.bbox.median_ms"]?.value ?? 0;
  const max = values["perf.bbox.max_ms"]?.value ?? 0;
  return (
    <>
      <div style={{ opacity: 1 - phaseB }}>
        {titles[0] ? <Heading text={titles[0].text ?? ""} f={titles[0].f} size={60} y={130} /> : null}
        {suitesCard?.value ? <StatCard value={suitesCard.value.value} unit={suitesCard.value.unit} label={suitesCard.text ?? ""} f={suitesCard.f} x={SAFE} y={280} w={520} /> : null}
        <SuiteList x={SAFE + 10} y={520} items={suites.map((b) => ({ text: b.text ?? "", f: b.f }))} />
        {big?.value ? <StatCard value={big.value.value} unit={big.value.unit} label={big.text ?? ""} f={big.f} x={760} y={280} w={1060} big /> : null}
        {small.map((b, i) =>
          b.value ? <StatCard key={b.id} value={b.value.value} unit={b.value.unit} label={b.text ?? ""} f={b.f} x={760 + (i % 2) * 540} y={560 + Math.floor(i / 2) * 230} w={520} /> : null,
        )}
      </div>
      {perfTitle ? (
        <div style={{ opacity: phaseB }}>
          <Heading text={perfTitle.text ?? ""} f={perfTitle.f} size={60} y={130} />
          {perfStats.map((b, i) =>
            b.value ? <StatCard key={b.id} value={b.value.value} unit={b.value.unit} label={b.text ?? ""} f={b.f} x={SAFE + i * 440} y={300} w={410} /> : null,
          )}
          <DotPlot samples={raw} median={median} max={max} f={perfStats[0]?.f ?? perfStart} x={SAFE} y={600} w={1700} />
        </div>
      ) : null}
      <Caption items={caps.map((c) => ({ text: c.text ?? "", f: c.f }))} />
    </>
  );
};
