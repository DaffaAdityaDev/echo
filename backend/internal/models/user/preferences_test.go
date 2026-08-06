package usermodel

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptr[T any](v T) *T { return &v }

func TestHarnessFeatureTogglesRoundTrip(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		toggle *HarnessFeatureToggles
	}{
		{
			name:   "empty toggles",
			toggle: &HarnessFeatureToggles{},
		},
		{
			name: "loop detection only",
			toggle: &HarnessFeatureToggles{
				LoopDetection: &LoopDetectionConfig{
					Enabled:                      true,
					EnableExactMatch:             ptr(true),
					MaxConsecutiveIdenticalCalls: ptr(5),
					WindowSize:                   ptr(20),
					SimilarityThreshold:          ptr(0.85),
				},
			},
		},
		{
			name: "budget monitor only",
			toggle: &HarnessFeatureToggles{
				BudgetMonitor: &BudgetMonitorConfig{
					Enabled:         true,
					EnforceMaxSteps: ptr(true),
					MaxSteps:        ptr(25),
					EnforceTimeout:  ptr(true),
					MaxDurationMs:   ptr(300000),
					EnforceCostCap:  ptr(true),
					MaxCostUsd:      ptr(2.50),
				},
			},
		},
		{
			name: "system notices only",
			toggle: &HarnessFeatureToggles{
				SystemNotices: &SystemNoticesConfig{
					Enabled:               true,
					EmitLoopWarnings:      ptr(true),
					EmitCompactionNotices: ptr(false),
					EmitBudgetWarnings:    ptr(true),
					EmitPacingWarnings:    ptr(true),
				},
			},
		},
		{
			name: "hitl guard only",
			toggle: &HarnessFeatureToggles{
				HitlGuard: &HitlGuardConfig{
					Enabled:        true,
					ProtectedTools: []string{"write_file", "delete_file"},
					TtlMinutes:     ptr(10),
				},
			},
		},
		{
			name: "context optimization only",
			toggle: &HarnessFeatureToggles{
				ContextOptimization: &ContextOptimizationConfig{
					Enabled:                   true,
					EnablePrefixCachingLayout: ptr(true),
					EnableAutoCompaction:      ptr(true),
					CompactionThresholdRatio:  ptr(0.75),
					KeepLastTurnsCount:        ptr(8),
				},
			},
		},
		{
			name: "all toggles enabled",
			toggle: &HarnessFeatureToggles{
				LoopDetection: &LoopDetectionConfig{
					Enabled:                      true,
					MaxConsecutiveIdenticalCalls: ptr(3),
					WindowSize:                   ptr(10),
				},
				BudgetMonitor: &BudgetMonitorConfig{
					Enabled:  true,
					MaxSteps: ptr(15),
				},
				SystemNotices: &SystemNoticesConfig{
					Enabled: true,
				},
				HitlGuard: &HitlGuardConfig{
					Enabled:        true,
					ProtectedTools: []string{"execute_sql_write"},
					TtlMinutes:     ptr(5),
				},
				ContextOptimization: &ContextOptimizationConfig{
					Enabled: true,
				},
			},
		},
		{
			name: "disabled toggles",
			toggle: &HarnessFeatureToggles{
				LoopDetection:       &LoopDetectionConfig{Enabled: false},
				BudgetMonitor:       &BudgetMonitorConfig{Enabled: false},
				SystemNotices:       &SystemNoticesConfig{Enabled: false},
				HitlGuard:           &HitlGuardConfig{Enabled: false},
				ContextOptimization: &ContextOptimizationConfig{Enabled: false},
			},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			data, err := json.Marshal(tt.toggle)
			require.NoError(t, err, "marshal should not error")

			var decoded HarnessFeatureToggles
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err, "unmarshal should not error")

			assert.Equal(t, tt.toggle, &decoded, "round-trip should produce identical struct")
		})
	}
}

func TestUserPreferencesHarnessTogglesRoundTrip(t *testing.T) {
	t.Parallel()

	prefs := &UserPreferences{
		UserID:       1,
		DefaultMode:  "agent",
		DefaultModel: "gpt-4o",
		HarnessToggles: &HarnessFeatureToggles{
			LoopDetection: &LoopDetectionConfig{
				Enabled:                      true,
				MaxConsecutiveIdenticalCalls: ptr(5),
			},
			BudgetMonitor: &BudgetMonitorConfig{
				Enabled:  true,
				MaxSteps: ptr(20),
			},
		},
	}

	data, err := json.Marshal(prefs)
	require.NoError(t, err)

	var decoded UserPreferences
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, prefs.UserID, decoded.UserID)
	assert.Equal(t, prefs.DefaultMode, decoded.DefaultMode)
	assert.Equal(t, prefs.DefaultModel, decoded.DefaultModel)
	require.NotNil(t, decoded.HarnessToggles)
	assert.Equal(t, prefs.HarnessToggles.LoopDetection.Enabled, decoded.HarnessToggles.LoopDetection.Enabled)
	assert.Equal(t, *prefs.HarnessToggles.LoopDetection.MaxConsecutiveIdenticalCalls, *decoded.HarnessToggles.LoopDetection.MaxConsecutiveIdenticalCalls)
	assert.Equal(t, prefs.HarnessToggles.BudgetMonitor.Enabled, decoded.HarnessToggles.BudgetMonitor.Enabled)
	assert.Equal(t, *prefs.HarnessToggles.BudgetMonitor.MaxSteps, *decoded.HarnessToggles.BudgetMonitor.MaxSteps)
}

func TestHarnessTogglesNilSubConfigs(t *testing.T) {
	t.Parallel()

	toggle := &HarnessFeatureToggles{
		LoopDetection: &LoopDetectionConfig{Enabled: true},
	}

	data, err := json.Marshal(toggle)
	require.NoError(t, err)

	var decoded HarnessFeatureToggles
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	require.NotNil(t, decoded.LoopDetection)
	assert.True(t, decoded.LoopDetection.Enabled)

	assert.Nil(t, decoded.BudgetMonitor)
	assert.Nil(t, decoded.SystemNotices)
	assert.Nil(t, decoded.HitlGuard)
	assert.Nil(t, decoded.ContextOptimization)
}

func TestProtectedToolsEmptySliceSerialization(t *testing.T) {
	t.Parallel()

	toggle := &HarnessFeatureToggles{
		HitlGuard: &HitlGuardConfig{
			Enabled:        true,
			ProtectedTools: []string{},
		},
	}

	data, err := json.Marshal(toggle)
	require.NoError(t, err)

	var decoded HarnessFeatureToggles
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	require.NotNil(t, decoded.HitlGuard)
	assert.Empty(t, decoded.HitlGuard.ProtectedTools)
}
