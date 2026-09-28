import type { FastifyInstance } from "fastify";
import { RetailerStatus } from "@prisma/client";

export interface RetailerLocation {
  latitude: number;
  longitude: number;
}

export interface ResolvedRetailerBranch {
  id: string;
  retailerId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  externalStoreCode: string;
  distanceKm: number;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two points.
 *
 * This is intentionally application-side rather than database-specific
 * so the resolver remains portable across MySQL/Cloud SQL environments.
 */
export function calculateDistanceKm(
  from: RetailerLocation,
  to: RetailerLocation,
): number {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    toRadians(to.latitude - from.latitude);

  const longitudeDifference =
    toRadians(to.longitude - from.longitude);

  const latitude1 =
    toRadians(from.latitude);

  const latitude2 =
    toRadians(to.latitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadiusKm * c;
}

export async function resolveNearestRetailerBranch(
  api: FastifyInstance,
  retailerId: string,
  location: RetailerLocation,
): Promise<ResolvedRetailerBranch | null> {
  const branches =
    await api.prisma.retailerBranch.findMany({
      where: {
        retailerId,
        status: RetailerStatus.ACTIVE,
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        externalStoreCode: {
          not: null,
        },
      },
      select: {
        id: true,
        retailerId: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        externalStoreCode: true,
      },
    });

  let nearest: ResolvedRetailerBranch | null = null;

  for (const branch of branches) {
    const latitude = toNumber(branch.latitude);
    const longitude = toNumber(branch.longitude);
    const externalStoreCode =
      branch.externalStoreCode?.trim();

    if (
      latitude === null ||
      longitude === null ||
      !externalStoreCode
    ) {
      continue;
    }

    const distanceKm =
      calculateDistanceKm(
        location,
        {
          latitude,
          longitude,
        },
      );

    const candidate: ResolvedRetailerBranch = {
      id: branch.id,
      retailerId: branch.retailerId,
      name: branch.name,
      address: branch.address,
      latitude,
      longitude,
      externalStoreCode,
      distanceKm,
    };

    if (
      nearest === null ||
      candidate.distanceKm < nearest.distanceKm
    ) {
      nearest = candidate;
    }
  }

  return nearest;
}
