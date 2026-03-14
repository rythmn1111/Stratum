import { CONFIG } from '../config';
import {
  BackendFetchShareRequest,
  BackendFetchShareResponse,
  BackendRegisterRequest,
  BackendRegisterResponse,
} from '../types';

const postJson = async <TReq, TRes>(path: string, payload: TReq): Promise<TRes> => {
  let response: Response;

  try {
    response = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (_error) {
    throw new Error(
      'Cannot reach backend API. Ensure backend is running and set src/config.ts apiBaseUrl to your computer LAN IP (not localhost) when using a physical phone.',
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed: ${response.status}`);
  }

  return (await response.json()) as TRes;
};

export const backendApi = {
  registerUser(payload: BackendRegisterRequest): Promise<BackendRegisterResponse> {
    /*
      Endpoint: POST /api/user/register
      Request:
      {
        deviceFingerprint: string,
        shareB: string (base64)
      }
      Response:
      {
        userId: string,
        sessionToken: string
      }
    */
    return postJson<BackendRegisterRequest, BackendRegisterResponse>('/api/user/register', payload);
  },

  fetchShareB(payload: BackendFetchShareRequest): Promise<BackendFetchShareResponse> {
    /*
      Endpoint: POST /api/share/fetch
      Request:
      {
        userId: string,
        deviceFingerprint: string,
        sessionToken: string
      }
      Response:
      {
        shareB: string (base64)
      }
    */
    return postJson<BackendFetchShareRequest, BackendFetchShareResponse>('/api/share/fetch', payload);
  },

  updateShareB(payload: {
    userId: string;
    deviceFingerprint: string;
    sessionToken: string;
    nextShareB: string;
  }): Promise<{ success: boolean }> {
    /*
      Endpoint: POST /api/share/update
      Request:
      {
        userId: string,
        deviceFingerprint: string,
        sessionToken: string,
        nextShareB: string (base64)
      }
      Response:
      {
        success: boolean
      }
    */
    return postJson('/api/share/update', payload);
  },
};
