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
import { SonarQubeBooleanMetricProvider } from './SonarQubeBooleanMetricProvider';
import {
  SONARQUBE_BOOLEAN_THRESHOLDS,
  SONARQUBE_METRIC_CONFIG,
  SONARQUBE_PROJECT_KEY_ANNOTATION,
} from './SonarQubeConfig';

jest.mock('../clients/SonarQubeClient');

const mockGetQualityGateStatus = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  const { SonarQubeClient } = jest.requireMock('../clients/SonarQubeClient');
  SonarQubeClient.mockImplementation(() => ({
    getQualityGateStatus: mockGetQualityGateStatus,
  }));
});

const mockConfig = mockServices.rootConfig.mock();
const mockLogger = mockServices.logger.mock();

describe('SonarQubeBooleanMetricProvider', () => {
  describe('getProviderDatasourceId', () => {
    it('should return sonarqube datasource id', () => {
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );
      expect(provider.getProviderDatasourceId()).toBe('sonarqube');
    });
  });

  describe('getProviderId', () => {
    it('should return sonarqube.qualityGate id for qualityGate metric', () => {
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );
      expect(provider.getProviderId()).toBe(
        SONARQUBE_METRIC_CONFIG.qualityGate.id,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return qualityGate metric with default thresholds', () => {
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );
      const metrics = provider.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual({
        id: SONARQUBE_METRIC_CONFIG.qualityGate.id,
        title: SONARQUBE_METRIC_CONFIG.qualityGate.title,
        description: SONARQUBE_METRIC_CONFIG.qualityGate.description,
        type: 'boolean',
        thresholds: SONARQUBE_BOOLEAN_THRESHOLDS,
        history: true,
      });
    });
  });

  describe('getCatalogFilter', () => {
    it('should require sonarqube project-key annotation', () => {
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );
      expect(provider.getCatalogFilter()).toEqual({
        [`metadata.annotations.${SONARQUBE_PROJECT_KEY_ANNOTATION}`]:
          CATALOG_FILTER_EXISTS,
      });
    });
  });

  describe('calculateMetrics', () => {
    it('should return true when quality gate passes', async () => {
      mockGetQualityGateStatus.mockResolvedValue(true);
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );

      const results = await provider.calculateMetrics(sonarqubeEntity());

      expect(results.get(provider.getProviderId())).toBe(true);
      expect(mockGetQualityGateStatus).toHaveBeenCalledWith(
        'my-project',
        undefined,
      );
    });

    it('should return false when quality gate fails', async () => {
      mockGetQualityGateStatus.mockResolvedValue(false);
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );

      const results = await provider.calculateMetrics(sonarqubeEntity());

      expect(results.get(provider.getProviderId())).toBe(false);
    });

    it('should pass instanceName when annotation has instance prefix', async () => {
      mockGetQualityGateStatus.mockResolvedValue(true);
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );

      await provider.calculateMetrics(sonarqubeEntity('internal/my-project'));

      expect(mockGetQualityGateStatus).toHaveBeenCalledWith(
        'my-project',
        'internal',
      );
    });

    it('should propagate error when client rejects', async () => {
      mockGetQualityGateStatus.mockRejectedValue(new Error('API down'));
      const provider = SonarQubeBooleanMetricProvider.fromConfig(
        mockConfig,
        mockLogger,
        'qualityGate',
      );

      await expect(
        provider.calculateMetrics(sonarqubeEntity()),
      ).rejects.toThrow('API down');
    });
  });
});
