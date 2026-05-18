import axios, { AxiosError } from 'axios';
import Endpoint, { IEndpoint } from '../models/Endpoint';
import EndpointCheck from '../models/EndpointCheck';

export interface CheckResult {
  status: 'up' | 'down' | 'degraded';
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export const probeEndpoint = async (endpoint: IEndpoint): Promise<CheckResult> => {
  const start = Date.now();
  try {
    const response = await axios.request({
      url: endpoint.url,
      method: endpoint.method,
      timeout: endpoint.timeoutMs,
      // We want to inspect non-2xx ourselves instead of throwing
      validateStatus: () => true,
      maxRedirects: 5
    });
    const responseTimeMs = Date.now() - start;
    const httpStatus = response.status;

    if (httpStatus === endpoint.expectedStatus) {
      return { status: 'up', httpStatus, responseTimeMs, error: null };
    }
    if (httpStatus >= 200 && httpStatus < 400) {
      return {
        status: 'degraded',
        httpStatus,
        responseTimeMs,
        error: `Got HTTP ${httpStatus}, expected ${endpoint.expectedStatus}`
      };
    }
    return {
      status: 'down',
      httpStatus,
      responseTimeMs,
      error: `HTTP ${httpStatus}`
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const ax = err as AxiosError;
    const error = ax.code ? `${ax.code}: ${ax.message}` : ax.message;
    return {
      status: 'down',
      httpStatus: null,
      responseTimeMs,
      error
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
    error: result.error
  });
  await Endpoint.updateOne(
    { _id: endpoint._id },
    {
      $set: {
        lastStatus: result.status,
        lastCheckedAt: new Date(),
        lastResponseTimeMs: result.responseTimeMs
      }
    }
  );
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
