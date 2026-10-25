// The map's "show my location" flow, free of React and native modules.
//
// A recent cached position centres the map straight away; a fresh fix then
// refines it, moving the camera again only if it moved meaningfully. Nothing
// here touches filters, selection or the saved Place location.
import { distanceMeters } from '@/location/geo';
import type {
  AcquireOptions,
  LocationAcquisition,
  LocationFailureReason,
  LocationFix,
} from '@/location/foreground-acquire';
import type { ForegroundPoint } from '@/location/foreground-types';

/** A refinement closer than this does not animate the camera again. */
export const REFINE_MOVE_THRESHOLD_METERS = 30;

export async function runMapLocate({
  acquire,
  moveCamera,
  notifyFailure,
  setPosition,
}: {
  acquire: (options: AcquireOptions) => Promise<LocationAcquisition>;
  moveCamera: (point: ForegroundPoint, durationMs: number) => void;
  notifyFailure: (reason: LocationFailureReason) => void;
  setPosition: (point: ForegroundPoint) => void;
}): Promise<void> {
  let centredOn: ForegroundPoint | null = null;
  const centre = (point: ForegroundPoint, durationMs: number) => {
    setPosition(point);
    moveCamera(point, durationMs);
    centredOn = point;
  };

  const result = await acquire({
    accuracy: 'balanced',
    onApproximate: (fix: LocationFix) => centre(fix.point, 400),
  });

  if (result.status === 'failed') {
    notifyFailure(result.reason);
    return;
  }
  const point = result.fix.point;
  if (!centredOn) {
    centre(point, 400);
  } else if (result.status === 'fix') {
    if (distanceMeters(centredOn, point) > REFINE_MOVE_THRESHOLD_METERS) centre(point, 250);
    else setPosition(point); // same place: refresh the marker without animating
  }
}
