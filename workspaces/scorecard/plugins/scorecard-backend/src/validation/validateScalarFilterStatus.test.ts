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

import { aggregationTypes } from '@red-hat-developer-hub/backstage-plugin-scorecard-common';
import { validateScalarFilterStatus } from './validateScalarFilterStatus';
import { ThresholdResolver } from '../threshold/ThresholdResolver';
import { MockNumberProvider } from '../../__fixtures__/mockProviders';
import { buildMockMetricProvidersRegistry } from '../../__fixtures__/mockMetricProvidersRegistry';
import { mockServices } from '@backstage/backend-test-utils';
import { MetricProvidersRegistry } from '../providers/MetricProvidersRegistry';
import { mockScalarAggregationConfig } from '../../__fixtures__/mockAggregationConfig';

describe('validateScalarFilterStatus', () => {
  let registry: MetricProvidersRegistry;
  let thresholdResolver: ThresholdResolver;

  const aggregationId = 'testFilterStatus';
  const metricId = 'jira.openIssues';
  const provider = new MockNumberProvider(metricId, 'jira');

  beforeEach(() => {
    registry = buildMockMetricProvidersRegistry({
      provider,
    });
    thresholdResolver = new ThresholdResolver(
      mockServices.rootConfig.mock(),
      registry.listProviders(),
    );

    jest.spyOn(thresholdResolver, 'resolveMetricThresholds');
  });

  it('should pass validation when filter is absent', () => {
    const aggregationConfig = mockScalarAggregationConfig(
      aggregationTypes.sum,
      {
        id: aggregationId,
        metricId,
      },
    );

    expect(() =>
      validateScalarFilterStatus({
        aggregationConfig,
        aggregationId,
        registry,
        thresholdResolver,
      }),
    ).not.toThrow();

    expect(registry.getProvider).not.toHaveBeenCalled();
  });

  it('should throw error if status is not a valid threshold key', () => {
    jest.clearAllMocks();

    const invalidAggregationConfig = mockScalarAggregationConfig(
      aggregationTypes.sum,
      {
        id: aggregationId,
        metricId,
        filter: { status: 'critical' },
      },
    );

    expect(() =>
      validateScalarFilterStatus({
        aggregationConfig: invalidAggregationConfig,
        aggregationId,
        registry,
        thresholdResolver,
      }),
    ).toThrow({
      name: 'InputError',
      message:
        'Aggregation KPI "testFilterStatus" filter.status "critical" is not a threshold rule key for metric "jira.openIssues". Valid keys: error, warning, success.',
    });
  });

  describe('when filter.status is present', () => {
    const aggregationConfig = mockScalarAggregationConfig(
      aggregationTypes.sum,
      {
        id: aggregationId,
        metricId,
        filter: { status: 'error' },
      },
    );

    beforeEach(() => {
      validateScalarFilterStatus({
        aggregationConfig,
        aggregationId,
        registry,
        thresholdResolver,
      });
    });

    it('should get provider value', () => {
      expect(registry.getProvider).toHaveBeenCalledWith(metricId);
    });

    it('should get metric value', () => {
      expect(registry.getMetric).toHaveBeenCalledWith(metricId);
    });

    it('should get provider id', () => {
      expect(provider.getProviderId()).toBe('jira.openIssues');
    });

    it('should resolve thresholds', () => {
      expect(thresholdResolver.resolveMetricThresholds).toHaveBeenCalledWith(
        provider.getMetrics()[0],
        'jira.openIssues',
      );
    });
  });
});
