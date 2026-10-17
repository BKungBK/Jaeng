import { coverPhotoUrl, toBbox } from './report';

describe('toBbox', () => {
  it('passes a normal view through', () => {
    expect(toBbox({ west: 99, south: 12, east: 101, north: 14 })).toEqual([99, 12, 101, 14]);
  });

  it('clamps a globe view to the world box', () => {
    expect(toBbox({ west: -250, south: -89, east: 250, north: 89 })).toEqual([-180, -85, 180, 85]);
  });

  it('widens a view that wraps past the antimeridian to all longitudes', () => {
    expect(toBbox({ west: 170, south: 0, east: 190, north: 10 })).toEqual([-180, 0, 180, 10]);
  });
});

describe('coverPhotoUrl', () => {
  it('points at the public photo bucket behind /sb', () => {
    expect(coverPhotoUrl('r1/p1.webp')).toBe(`${location.origin}/sb/storage/v1/object/public/photos-public/r1/p1.webp`);
  });
});
