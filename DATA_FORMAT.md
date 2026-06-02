# Data Format

TrajGram stores data in one normalized internal format. Incoming data can be loose; the loader will try to normalize it first.

## 1. Standard Internal Shapes

### Trajectory

```ts
type Trajectory = {
  id: string;
  starttime: string;
  endtime: string;
  distance: number;
  shapingPoints: Trajectorypoint[];
  attributes?: Record<string, unknown>;
}
```

### Trajectory Point

```ts
type Trajectorypoint = {
  id: string;
  basePoint: {
    time?: string;
    position: { lng: number; lat: number };
  };
  attributes: {
    source?: { tid?: string; sid?: string };
    computed?: {
      trajDP?: number;
      trajTP?: number;
      segDP?: number;
      direction?: { x: number; y: number };
    };
    others?: Record<string, unknown>;
  };
}
```

### Road Network Item

```ts
type RoadNetworkItem = {
  id: string;
  distance: number;
  shapingPoints: Trajectorypoint[];
  attributes?: {
    volume?: number;
    speed?: number;
  };
}
```

## 2. Accepted Trajectory Inputs

TrajGram accepts these common forms and normalizes them into the standard `Trajectory[]` shape:

- Standard trajectory objects with `shapingPoints`
- Compact objects with `points`, `samples`, or `coordinates`
- GeoJSON `Feature` / `FeatureCollection` with `LineString`
- Point positions written as:
  - `[lng, lat]`
  - `{ lng, lat }`
  - `{ lon, lat }`
  - `{ x, y }`

## 3. Normalization Rules

- Missing `id` is auto-generated.
- Missing `starttime` / `endtime` are inferred from point times when possible.
- Missing `distance` is computed from `shapingPoints` when possible.
- Missing point `source.tid` is filled with the parent trajectory id.
- Unsupported or invalid points are skipped instead of crashing the whole dataset.

## 4. Recommended Authoring Format

Use this form when possible:

```json
{
  "id": "T1",
  "starttime": "2024-01-01T08:00:00Z",
  "endtime": "2024-01-01T08:10:00Z",
  "distance": 5.2,
  "shapingPoints": [
    {
      "id": "P1",
      "basePoint": {
        "time": "2024-01-01T08:00:00Z",
        "position": { "lng": 120.18, "lat": 30.27 }
      },
      "attributes": {
        "source": { "sid": "road_1" },
        "others": { "speed": 32 }
      }
    }
  ],
  "attributes": {}
}
```

## 5. Notes

- `trajectory` data should be treated as time-ordered.
- `roadnetwork` data should include a stable `id`.
- `geojson` data is kept as GeoJSON and not converted into trajectory objects.
