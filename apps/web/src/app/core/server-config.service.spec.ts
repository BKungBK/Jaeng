import { TestBed } from '@angular/core/testing';
import { publicPhotoUrl, ServerConfigService, serverOrigin, serverUrl, setServerOrigin } from './server-config.service';

describe('server address', () => {
  afterEach(() => setServerOrigin(null));

  it('is the page origin on the web', () => {
    expect(serverOrigin()).toBe(location.origin);
    expect(serverUrl('/sb/storage/x.webp')).toBe(`${location.origin}/sb/storage/x.webp`);
  });

  it('is the saved address in the app', () => {
    setServerOrigin('http://192.168.1.5:8000');
    expect(serverOrigin()).toBe('http://192.168.1.5:8000');
    expect(serverUrl('/sb/storage/x.webp')).toBe('http://192.168.1.5:8000/sb/storage/x.webp');
    const service = TestBed.inject(ServerConfigService);
    expect(service.apiUrl('/reports')).toBe('http://192.168.1.5:8000/api/reports');
    expect(service.sbUrl()).toBe('http://192.168.1.5:8000/sb');
  });

  it('puts the server in front of a public photo path', () => {
    setServerOrigin('http://192.168.1.5:8000/');
    expect(publicPhotoUrl('r1/p1.webp')).toBe('http://192.168.1.5:8000/sb/storage/v1/object/public/photos-public/r1/p1.webp');
  });

  it('leaves full URLs alone', () => {
    setServerOrigin('http://192.168.1.5:8000');
    expect(serverUrl('https://a.b/c.png')).toBe('https://a.b/c.png');
    expect(serverUrl('blob:xyz')).toBe('blob:xyz');
    expect(serverUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
  });
});
