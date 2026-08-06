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

import { sonarqubeEntity } from '../../__fixtures__/sonarqubeEntity';
import {
  parseProjectKeyAnnotation,
  SONARQUBE_API_METRIC_KEYS,
  SONARQUBE_BOOLEAN_THRESHOLDS,
  SONARQUBE_METRIC_CONFIG,
  SONARQUBE_METRICS,
  SONARQUBE_NUMBER_METRICS,
  SONARQUBE_NUMBER_THRESHOLDS,
  SONARQUBE_PROJECT_KEY_ANNOTATION,
} from './SonarQubeConfig';

describe('parseProjectKeyAnnotation', () => {
  it('should throw when annotation is missing', () => {
    expect(() => parseProjectKeyAnnotation(sonarqubeEntity(null))).toThrow(
      `Missing annotation '${SONARQUBE_PROJECT_KEY_ANNOTATION}' for entity component:default/my-service`,
    );
  });

  it('should return projectKey when annotation has no instance prefix', () => {
    expect(parseProjectKeyAnnotation(sonarqubeEntity('my-project'))).toEqual({
      projectKey: 'my-project',
    });
  });

  it('should return instanceName and projectKey when annotation has instance prefix', () => {
    expect(
      parseProjectKeyAnnotation(sonarqubeEntity('internal/my-project')),
    ).toEqual({
      instanceName: 'internal',
      projectKey: 'my-project',
    });
  });

  it('should split on the first slash when project key contains additional slashes', () => {
    expect(parseProjectKeyAnnotation(sonarqubeEntity('a/b/c'))).toEqual({
      instanceName: 'a',
      projectKey: 'b/c',
    });
  });
});

describe('SONARQUBE_METRIC_CONFIG', () => {
  it.each(SONARQUBE_METRICS)(
    'should map %s to sonarqube.%s metric id',
    metricId => {
      expect(SONARQUBE_METRIC_CONFIG[metricId].id).toBe(
        `sonarqube.${metricId}`,
      );
    },
  );
});

describe('SONARQUBE_API_METRIC_KEYS', () => {
  it.each([
    ['qualityGate', { useQualityGateApi: true }],
    ['openIssues', { useOpenIssuesApi: true }],
    ['securityRating', { apiKey: 'security_rating' }],
    ['securityIssues', { apiKey: 'vulnerabilities' }],
    ['securityReviewRating', { apiKey: 'security_review_rating' }],
    ['securityHotspots', { apiKey: 'security_hotspots' }],
    ['reliabilityRating', { apiKey: 'reliability_rating' }],
    ['reliabilityIssues', { apiKey: 'bugs' }],
    ['maintainabilityRating', { apiKey: 'sqale_rating' }],
    ['maintainabilityIssues', { apiKey: 'code_smells' }],
    ['codeCoverage', { apiKey: 'coverage' }],
    ['codeDuplications', { apiKey: 'duplicated_lines_density' }],
  ] as const)(
    'should map %s to the expected SonarQube API key',
    (metricId, mapping) => {
      expect(SONARQUBE_API_METRIC_KEYS[metricId]).toEqual(mapping);
    },
  );
});

describe('SONARQUBE_BOOLEAN_THRESHOLDS', () => {
  it('should define default quality gate thresholds', () => {
    expect(SONARQUBE_BOOLEAN_THRESHOLDS).toEqual({
      rules: [
        { key: 'success', expression: '==true' },
        { key: 'error', expression: '==false' },
      ],
    });
  });
});

describe('SONARQUBE_NUMBER_THRESHOLDS', () => {
  it.each(SONARQUBE_NUMBER_METRICS)(
    'should define default thresholds for %s',
    metricId => {
      expect(
        SONARQUBE_NUMBER_THRESHOLDS[metricId].rules.length,
      ).toBeGreaterThan(0);
    },
  );

  it('should lock openIssues default threshold expressions', () => {
    expect(SONARQUBE_NUMBER_THRESHOLDS.openIssues.rules).toEqual([
      { key: 'success', expression: '<1' },
      { key: 'warning', expression: '1-10' },
      { key: 'error', expression: '>10' },
    ]);
  });

  it('should lock rating default threshold expressions', () => {
    expect(SONARQUBE_NUMBER_THRESHOLDS.securityRating.rules).toEqual([
      {
        key: 'A',
        expression: '==1',
        color: 'success.main',
        icon: 'scorecardSuccessStatusIcon',
      },
      {
        key: 'B',
        expression: '==2',
        color: '#bdcb28',
        icon: 'scorecardSuccessStatusIcon',
      },
      {
        key: 'C',
        expression: '==3',
        color: 'warning.main',
        icon: 'scorecardWarningStatusIcon',
      },
      {
        key: 'D',
        expression: '==4',
        color: '#cf5813',
        icon: 'scorecardErrorStatusIcon',
      },
      {
        key: 'E',
        expression: '==5',
        color: 'error.main',
        icon: 'scorecardErrorStatusIcon',
      },
    ]);
    expect(SONARQUBE_NUMBER_THRESHOLDS.securityReviewRating).toBe(
      SONARQUBE_NUMBER_THRESHOLDS.securityRating,
    );
    expect(SONARQUBE_NUMBER_THRESHOLDS.reliabilityRating).toBe(
      SONARQUBE_NUMBER_THRESHOLDS.securityRating,
    );
    expect(SONARQUBE_NUMBER_THRESHOLDS.maintainabilityRating).toBe(
      SONARQUBE_NUMBER_THRESHOLDS.securityRating,
    );
  });

  it('should lock codeCoverage default threshold expressions', () => {
    expect(SONARQUBE_NUMBER_THRESHOLDS.codeCoverage.rules).toEqual([
      { key: 'success', expression: '>80' },
      { key: 'warning', expression: '50-80' },
      { key: 'error', expression: '<50' },
    ]);
  });

  it('should lock codeDuplications default threshold expressions', () => {
    expect(SONARQUBE_NUMBER_THRESHOLDS.codeDuplications.rules).toEqual([
      { key: 'success', expression: '<3' },
      { key: 'warning', expression: '3-10' },
      { key: 'error', expression: '>10' },
    ]);
  });
});
