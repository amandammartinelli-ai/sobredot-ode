import { describe, it, expect } from 'vitest';
import { extractRecordDraftsFromTranscript } from '../../src/utils/speechRecordExtraction.js';

describe('extractRecordDraftsFromTranscript', () => {
  it('returns no drafts for an empty transcript', () => {
    expect(extractRecordDraftsFromTranscript('')).toEqual([]);
    expect(extractRecordDraftsFromTranscript('   ')).toEqual([]);
  });

  it('splits a run-on narration into one draft per segment', () => {
    const drafts = extractRecordDraftsFromTranscript(
      'dormiu muito mal e acordou várias vezes depois recusou o almoço todo'
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0].categoryId).toBe('sleep');
    expect(drafts[1].categoryId).toBe('food');
  });

  it('respects normal punctuation when the browser provides it', () => {
    const drafts = extractRecordDraftsFromTranscript('Dormiu bem. Comeu tudo ao almoço!');
    expect(drafts.map((d) => d.categoryId)).toEqual(['sleep', 'food']);
  });

  it('falls back to observations when no keyword matches, instead of dropping the segment', () => {
    const drafts = extractRecordDraftsFromTranscript('esteve no parque a tarde toda');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].categoryId).toBe('observations');
    expect(drafts[0].notes).toBe('esteve no parque a tarde toda');
  });

  it('guesses intensity from common adverbs, defaulting to medium', () => {
    expect(extractRecordDraftsFromTranscript('chorou muito')[0].intensity).toBe('high');
    expect(extractRecordDraftsFromTranscript('chorou um pouco')[0].intensity).toBe('low');
    expect(extractRecordDraftsFromTranscript('chorou')[0].intensity).toBe('medium');
  });

  it('splits a punctuation-free, connector-free run-on sentence at each new topic (reported live: "Hoje meu filho acordou bem disposto comeu pouco e brincou bastante")', () => {
    const drafts = extractRecordDraftsFromTranscript(
      'Hoje meu filho acordou bem disposto comeu pouco e brincou bastante'
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0].categoryId).toBe('sleep');
    expect(drafts[0].notes).toBe('Hoje meu filho acordou bem disposto');
    expect(drafts[1].categoryId).toBe('food');
    expect(drafts[1].notes).toBe('comeu pouco e brincou bastante');
  });

  it('does not split when the same category is mentioned more than once in a row', () => {
    const drafts = extractRecordDraftsFromTranscript('dormiu muito mal e acordou de madrugada outra vez');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].categoryId).toBe('sleep');
  });

  it('recognizes keywords across all ten record categories', () => {
    const bySentence = {
      'chorou muito de manhã': 'emotions',
      'fez birra na hora de sair': 'behaviors',
      'dormiu mal a noite toda': 'sleep',
      'recusou a comida ao jantar': 'food',
      'tomou o remédio sem problema': 'medication',
      'gostou da aula de hoje': 'school',
      'apontou para o copo pedindo água': 'communication',
      'tapou os ouvidos com o barulho': 'sensory',
      'conseguiu vestir-se sozinho pela primeira vez': 'achievements',
    };
    Object.entries(bySentence).forEach(([sentence, expectedCategory]) => {
      expect(extractRecordDraftsFromTranscript(sentence)[0].categoryId).toBe(expectedCategory);
    });
  });
});
