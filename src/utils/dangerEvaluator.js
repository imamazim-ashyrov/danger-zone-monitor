import {
  intersectionArea,
  personBoxToRect,
  rectEdgeDistance,
  getPersonDangerPoint,
  pointInsideRect,
} from "./geometry";

const DANGER_RATIO_THRESHOLD = 0.03;
const PROXIMITY_PX_THRESHOLD = 60;
const PERSON_POINT_PADDING = 20;

export function evaluateDanger(persons, zones) {
  if (!zones || !zones.length || !persons || !persons.length) {
    return { danger: false, message: null };
  }

  for (const person of persons) {
    const personRect = personBoxToRect(person.bbox);
    const personArea = personRect.width * personRect.height;
    if (personArea <= 0) continue;

    const personDangerPoint = getPersonDangerPoint(personRect);

    for (const zone of zones) {
      const overlap = intersectionArea(personRect, zone.rect);
      const overlapRatio = overlap / personArea;
      const edgeDistance = rectEdgeDistance(personRect, zone.rect);

      const pointNearZone = pointInsideRect(
        personDangerPoint,
        zone.rect,
        PERSON_POINT_PADDING
      );

      if (
        overlapRatio >= DANGER_RATIO_THRESHOLD ||
        edgeDistance <= PROXIMITY_PX_THRESHOLD ||
        pointNearZone
      ) {
        return { danger: true, message: `Кооптуу аймак: ${zone.label}` };
      }
    }
  }

  return { danger: false, message: null };
}
