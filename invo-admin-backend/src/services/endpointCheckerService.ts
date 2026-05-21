import axios, { AxiosError } from 'axios';
import Endpoint, { IEndpoint } from '../models/Endpoint';
import EndpointCheck from '../models/EndpointCheck';
import { emit } from './wsService';

export interface CheckResult {
  status: 'up' | 'down' | 'degraded';
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
  responseBody: Record<string, unknown> | null;
}

const extractBody = (data: unknown): Record<string, unknown> | null => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
};

export const probeEndpoint = async (endpoint: IEndpoint): Promise<CheckResult> => {
  const start = Date.now();
  try {
    const response = await axios.request({
      url: endpoint.url,
      method: endpoint.method,
      timeout: endpoint.timeoutMs,
      validateStatus: () => true,
      maxRedirects: 5
    });
    const responseTimeMs = Date.now() - start;
    const httpStatus = response.status;
    const responseBody = extractBody(response.data);

    if (httpStatus === endpoint.expectedStatus) {
      return { status: 'up', httpStatus, responseTimeMs, error: null, responseBody };
    }
    if (httpStatus >= 200 && httpStatus < 400) {
      return {
        status: 'degraded',
        httpStatus,
        responseTimeMs,
        error: `Got HTTP ${httpStatus}, expected ${endpoint.expectedStatus}`,
        responseBody
      };
    }
    return {
      status: 'down',
      httpStatus,
      responseTimeMs,
      error: `HTTP ${httpStatus}`,
      responseBody
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const ax = err as AxiosError;
    const error = ax.code ? `${ax.code}: ${ax.message}` : ax.message;
    return {
      status: 'down',
      httpStatus: null,
      responseTimeMs,
      error,
      responseBody: null
    };
  }
};

/**
 * Probe a single endpoint, persist the result and update the endpoint's denormalized status.
 */
export const checkAndPersist = async (endpoint: IEndpoint): Promise<CheckResult> => {
  const result = await probeEndpoint(endpoint);
  await EndpointCheck.create({
    endpointId: endpoint._id,
    checkedAt: new Date(),
    status: result.status,
    httpStatus: result.httpStatus,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
    responseBody: result.responseBody
  });
  const now = new Date();
  await Endpoint.updateOne(
    { _id: endpoint._id },
    {
      $set: {
        lastStatus: result.status,
        lastCheckedAt: now,
        lastResponseTimeMs: result.responseTimeMs
      }
    }
  );
  emit('endpoint:updated', {
    _id: String(endpoint._id),
    environmentId: String(endpoint.environmentId),
    lastStatus: result.status,
    lastResponseTimeMs: result.responseTimeMs,
    lastCheckedAt: now,
    // Full check snapshot so detail pages can update without a re-fetch
    check: {
      _id: null, // not needed for live update
      endpointId: String(endpoint._id),
      checkedAt: now,
      status: result.status,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
      responseBody: result.responseBody
    }
  });
  return result;
};

/**
 * Probe many endpoints concurrently with bounded parallelism.
 */
export const checkEndpointsBatch = async (
  endpoints: IEndpoint[],
  concurrency = 20
): Promise<void> => {
  let index = 0;
  const workers: Promise<void>[] = [];
  const next = async (): Promise<void> => {
    while (index < endpoints.length) {
      const i = index++;
      try {
        await checkAndPersist(endpoints[i]);
      } catch (err) {
        console.error(
          `[ENDPOINT_CHECK] Error checking endpoint ${endpoints[i]._id}:`,
          (err as Error).message
        );
      }
    }
  };
  for (let w = 0; w < Math.min(concurrency, endpoints.length); w++) {
    workers.push(next());
  }
  await Promise.all(workers);
};
