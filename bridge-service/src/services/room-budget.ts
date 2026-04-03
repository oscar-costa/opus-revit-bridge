import type { QuantityCandidate } from "./mapping-service.js";
import type { RoomInfo } from "../types.js";

export function buildRoomQuantityCandidates(rooms: RoomInfo[]): QuantityCandidate[] {
  return rooms.map((room) => ({
    sourceCategory: "OST_Rooms",
    sourceElementIds: [room.id],
    description: `${room.number} - ${room.name}`,
    unit: "m2",
    quantity: room.area,
    levelName: room.level,
  }));
}
