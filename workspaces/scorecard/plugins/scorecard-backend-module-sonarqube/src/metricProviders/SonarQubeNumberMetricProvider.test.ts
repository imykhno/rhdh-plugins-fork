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
import { CATALOG_FILTER_EXISTS } from '@backstage/catalog-client';

import { sonarqubeEntity } from '../../__fixtures__/sonarqubeEntity';
import { SonarQubeNumberMetricProvider } from './SonarQubeNumberMetricProvider';
import {
  SONARQUBE_METRIC_CONFIG,
  SONARQUBE_NUMBER_THRESHOLDS,
  SONARQUBE_PROJECT_KEY_ANNOTATION,
} from './SonarQubeConfig';

jest.mock('../clients/SonarQubeClient');

const mockGetOpenIssuesCount = jest.fn();
const mockGetMeasures = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  const { SonarQubeClient } = jest.requireMock('../clients/SonarQubeClient');
  SonarQubeClient.mockImplementation(() => ({
    getOpenIssuesCount: mockGetOpenIssuesCount,
    getMeasures: mockGetMeasures,
  }));
});

const mockConfig = mockServices.rootConfig.mock();
const mockLogger = mockServices.logger.mock();

describe('SonarQubeNumberMetricProvider', () => {
  describe('getProviderDatasourceId', () => {
    it('should return sonarqube datasource id', () => {
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );
      expect(provider.getProviderDatasourceId()).toBe('sonarqube');
    });
  });

  describe('getProviderId', () => {
    it('should return sonarqube.openIssues id for openIssues metric', () => {
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );
      expect(provider.getProviderId()).toBe(
        SONARQUBE_METRIC_CONFIG.openIssues.id,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return openIssues metric with default thresholds', () => {
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );
      const metrics = provider.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual({
        id: SONARQUBE_METRIC_CONFIG.openIssues.id,
        title: SONARQUBE_METRIC_CONFIG.openIssues.title,
        thresholds: SONARQUBE_NUMBER_THRESHOLDS.openIssues,
        description: SONARQUBE_METRIC_CONFIG.openIssues.description,
        type: 'number',
        history: true,
      });
    });
  });

  describe('getCatalogFilter', () => {
    it('should require sonarqube project-key annotation', () => {
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );
      expect(provider.getCatalogFilter()).toEqual({
        [`metadata.annotations.${SONARQUBE_PROJECT_KEY_ANNOTATION}`]:
          CATALOG_FILTER_EXISTS,
      });
    });
  });

  describe('calculateMetrics', () => {
    it('should call getOpenIssuesCount for openIssues metric', async () => {
      mockGetOpenIssuesCount.mockResolvedValue(42);
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );

      const results = await provider.calculateMetrics(sonarqubeEntity());

      expect(results.get(provider.getProviderId())).toBe(42);
      expect(mockGetOpenIssuesCount).toHaveBeenCalledWith(
        'my-project',
        undefined,
      );
      expect(mockGetMeasures).not.toHaveBeenCalled();
    });

    it.each([
      ['securityRating', 'security_rating', 2],
      ['securityIssues', 'vulnerabilities', 7],
      ['securityReviewRating', 'security_review_rating', 1],
      ['securityHotspots', 'security_hotspots', 3],
      ['reliabilityRating', 'reliability_rating', 1],
      ['reliabilityIssues', 'bugs', 12],
      ['maintainabilityRating', 'sqale_rating', 2],
      ['maintainabilityIssues', 'code_smells', 45],
      ['codeCoverage', 'coverage', 82.5],
      ['codeDuplications', 'duplicated_lines_density', 3.2],
    ] as const)(
      'should return measure value when metric is %s',
      async (metricId, apiKey, value) => {
        mockGetMeasures.mockResolvedValue({ [apiKey]: value });
        const provider = SonarQubeNumberMetricProvider.fromConfig(
          mockConfig,
          mockLogger,
          metricId,
        );

        const results = await provider.calculateMetrics(sonarqubeEntity());

        expect(results.get(provider.getProviderId())).toBe(value);
        expect(mockGetMeasures).toHaveBeenCalledWith(
          'my-project',
          [apiKey],
          undefined,
        );
        expect(mockGetOpenIssuesCount).not.toHaveBeenCalled();
      },
    );

    it('should pass instanceName when annotation has instance prefix', async () => {
      mockGetOpenIssuesCount.mockResolvedValue(5);
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );

      await provider.calculateMetrics(sonarqubeEntity('internal/my-project'));

      expect(mockGetOpenIssuesCount).toHaveBeenCalledWith(
        'my-project',
        'internal',
      );
    });

    it('should return 0 when no open issues', async () => {
      mockGetOpenIssuesCount.mockResolvedValue(0);
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );

      const results = await provider.calculateMetrics(sonarqubeEntity());
      expect(results.get(provider.getProviderId())).toBe(0);
    });

    it('should return undefined when requested measure key is missing', async () => {
      mockGetMeasures.mockResolvedValue({});
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'securityRating',
      );

      const results = await provider.calculateMetrics(sonarqubeEntity());

      expect(results.get(provider.getProviderId())).toBeUndefined();
      expect(mockGetMeasures).toHaveBeenCalledWith(
        'my-project',
        ['security_rating'],
        undefined,
      );
    });

    it('should propagate error when client rejects', async () => {
      mockGetOpenIssuesCount.mockRejectedValue(new Error('API down'));
      const provider = SonarQubeNumberMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'openIssues',
      );

      await expect(
        provider.calculateMetrics(sonarqubeEntity()),
      ).rejects.toThrow('API down');
    });
  });
});
