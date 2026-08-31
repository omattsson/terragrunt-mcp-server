import { describe, it, expect } from 'vitest';
import { parseExperiments } from '../../scripts/update-experiments-fixture.js';

const SAMPLE = `
const (
	Symlinks = "symlinks"
	CLIRedesign = "cli-redesign"
	CAS = "cas"
	DeepMerge = "deep-merge"
	OCI = "oci"
)

const (
	StatusOngoing byte = iota
	StatusCompleted
)

func NewExperiments() Experiments {
	return Experiments{
		{
			Name: Symlinks,
		},
		{
			Name:   CLIRedesign,
			Status: StatusCompleted,
		},
		{
			Name:   CAS,
			Status: StatusCompleted,
		},
		{
			Name: DeepMerge,
		},
		{
			Name: OCI,
		},
	}
}
`;

describe('parseExperiments', () => {
  it('splits active and completed experiments and resolves names', () => {
    const result = parseExperiments(SAMPLE);
    expect(result.completed).toEqual(['cas', 'cli-redesign']);
    expect(result.active).toEqual(['deep-merge', 'oci', 'symlinks']);
  });

  it('throws when no experiments are found', () => {
    expect(() => parseExperiments('package experiment')).toThrow(/no experiments/i);
  });
});
