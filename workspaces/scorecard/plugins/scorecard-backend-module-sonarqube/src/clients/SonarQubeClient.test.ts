/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mockServices } from '@backstage/backend-test-utils';

import { SonarQubeClient } from './SonarQubeClient';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

function mockOkJson(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  });
}

describe('SonarQubeClient', () => {
  const config = mockServices.rootConfig({
    data: {
      sonarqube: {
        baseUrl: 'https://sonarcloud.io',
        apiKey: 'test-key',
      },
    },
  });
  const logger = mockServices.logger.mock();

  let client: SonarQubeClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new SonarQubeClient(config, logger);
  });

  describe('request configuration', () => {
    it('should throw when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getQualityGateStatus('my-project')).rejects.toThrow(
        /SonarQube API error: 401 Unauthorized/,
      );
    });

    it('should default baseUrl to https://sonarcloud.io when not configured', async () => {
      const defaultClient = new SonarQubeClient(
        mockServices.rootConfig({}),
        logger,
      );
      mockOkJson({ projectStatus: { status: 'OK' } });

      await defaultClient.getQualityGateStatus('my-project');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/qualitygates/project_status?projectKey=my-project',
        expect.any(Object),
      );
    });

    it('should strip trailing slash from baseUrl', async () => {
      const clientWithSlash = new SonarQubeClient(
        mockServices.rootConfig({
          data: {
            sonarqube: {
              baseUrl: 'https://sonarcloud.io/',
              apiKey: 'test-key',
            },
          },
        }),
        logger,
      );
      mockOkJson({ projectStatus: { status: 'OK' } });

      await clientWithSlash.getQualityGateStatus('my-project');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/qualitygates/project_status?projectKey=my-project',
        expect.any(Object),
      );
    });

    it('should send Authorization header with base64-encoded Basic auth by default', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await client.getQualityGateStatus('my-project');

      const expectedToken = Buffer.from('test-key:').toString('base64');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: `Basic ${expectedToken}` },
        }),
      );
    });

    it('should send no Authorization header when apiKey is not configured', async () => {
      const noKeyClient = new SonarQubeClient(
        mockServices.rootConfig({
          data: {
            sonarqube: {
              baseUrl: 'https://sonarcloud.io',
            },
          },
        }),
        logger,
      );
      mockOkJson({ projectStatus: { status: 'OK' } });

      await noKeyClient.getQualityGateStatus('my-project');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  describe('named instances', () => {
    const multiConfig = mockServices.rootConfig({
      data: {
        sonarqube: {
          baseUrl: 'https://sonarcloud.io',
          apiKey: 'default-key',
          instances: [
            {
              name: 'internal',
              baseUrl: 'https://sonar.internal.com',
              apiKey: 'internal-key',
              authType: 'Bearer',
            },
            {
              name: 'basic-instance',
              baseUrl: 'https://sonar.basic.com',
              apiKey: 'basic-key',
              authType: 'Basic',
            },
            {
              name: 'public',
              baseUrl: 'https://sonarcloud.io',
            },
          ],
        },
      },
    });

    let multiClient: SonarQubeClient;

    beforeEach(() => {
      multiClient = new SonarQubeClient(multiConfig, logger);
    });

    it('should throw when named instance is not found', async () => {
      await expect(
        multiClient.getQualityGateStatus('my-project', 'unknown'),
      ).rejects.toThrow(
        "SonarQube instance 'unknown' not found in configuration",
      );
    });

    it('should throw when instanceName is set but instances array is absent', async () => {
      await expect(
        client.getQualityGateStatus('my-project', 'unknown'),
      ).rejects.toThrow(
        "SonarQube instance 'unknown' not found in configuration",
      );
    });

    it('should use named instance when instanceName is provided', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await multiClient.getQualityGateStatus('my-project', 'internal');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonar.internal.com/api/qualitygates/project_status?projectKey=my-project',
        expect.objectContaining({
          headers: { Authorization: 'Bearer internal-key' },
        }),
      );
    });

    it('should use Basic auth when named instance sets authType Basic', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await multiClient.getQualityGateStatus('my-project', 'basic-instance');

      const expectedToken = Buffer.from('basic-key:').toString('base64');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonar.basic.com/api/qualitygates/project_status?projectKey=my-project',
        expect.objectContaining({
          headers: { Authorization: `Basic ${expectedToken}` },
        }),
      );
    });

    it('should use default instance when no instanceName is provided', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await multiClient.getQualityGateStatus('my-project');

      const expectedToken = Buffer.from('default-key:').toString('base64');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/qualitygates/project_status?projectKey=my-project',
        expect.objectContaining({
          headers: { Authorization: `Basic ${expectedToken}` },
        }),
      );
    });

    it('should send no Authorization header for instance without apiKey', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await multiClient.getQualityGateStatus('my-project', 'public');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  describe('getQualityGateStatus', () => {
    it('should return true when quality gate status is OK', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      const result = await client.getQualityGateStatus('my-project');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/qualitygates/project_status?projectKey=my-project',
        expect.any(Object),
      );
    });

    it('should return false when quality gate status is not OK', async () => {
      mockOkJson({ projectStatus: { status: 'ERROR' } });

      const result = await client.getQualityGateStatus('my-project');

      expect(result).toBe(false);
    });

    it('should URL-encode project keys with special characters', async () => {
      mockOkJson({ projectStatus: { status: 'OK' } });

      await client.getQualityGateStatus('org/my project');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/qualitygates/project_status?projectKey=org%2Fmy%20project',
        expect.any(Object),
      );
    });
  });

  describe('getOpenIssuesCount', () => {
    it('should return the total count of open issues', async () => {
      mockOkJson({ total: 42 });

      const result = await client.getOpenIssuesCount('my-project');

      expect(result).toBe(42);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/issues/search?componentKeys=my-project&statuses=OPEN,CONFIRMED,REOPENED&ps=1',
        expect.any(Object),
      );
    });

    it('should URL-encode project keys with special characters', async () => {
      mockOkJson({ total: 42 });

      await client.getOpenIssuesCount('org/my project');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/issues/search?componentKeys=org%2Fmy%20project&statuses=OPEN,CONFIRMED,REOPENED&ps=1',
        expect.any(Object),
      );
    });
  });

  describe('getMeasures', () => {
    it('should return measures as a record of metric key to number', async () => {
      mockOkJson({
        component: {
          measures: [
            { metric: 'security_rating', value: '2.0' },
            { metric: 'vulnerabilities', value: '5' },
          ],
        },
      });

      const result = await client.getMeasures('my-project', [
        'security_rating',
        'vulnerabilities',
      ]);

      expect(result).toEqual({ security_rating: 2, vulnerabilities: 5 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/measures/component?component=my-project&metricKeys=security_rating%2Cvulnerabilities',
        expect.any(Object),
      );
    });

    it('should URL-encode project keys with special characters', async () => {
      mockOkJson({ component: { measures: [] } });

      await client.getMeasures('org/my project', ['security_rating']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sonarcloud.io/api/measures/component?component=org%2Fmy%20project&metricKeys=security_rating',
        expect.any(Object),
      );
    });
  });
});
