import { describe, expect, it } from 'vitest';
import { findMatches, matchSizeAt } from '../src/core/match';
import { stateFrom } from './helpers';

const b = (rows: string[]) => stateFrom(rows).board;

describe('findMatches', () => {
  it('finds nothing on a board without matches', () => {
    expect(findMatches(b(['0123', '1230', '2301', '3012']))).toEqual([]);
  });

  it('finds a horizontal line of 3 (no special)', () => {
    const g = findMatches(b(['0001', '1232', '2323']));
    expect(g).toHaveLength(1);
    expect(g[0].color).toBe(0);
    expect(g[0].cells).toHaveLength(3);
    expect(g[0].special).toBe('none');
  });

  it('finds a vertical line of 3', () => {
    const g = findMatches(b(['012', '013', '024', '345']));
    expect(g).toHaveLength(1);
    expect(g[0].cells.map((p) => p.x)).toEqual([0, 0, 0]);
  });

  it('4 in a row horizontally → rocket clearing the column (rocketV)', () => {
    const g = findMatches(b(['00001', '12323', '23232']));
    expect(g[0].special).toBe('rocketV');
    expect(g[0].at).not.toBeNull();
  });

  it('4 in a column → rocketH', () => {
    const g = findMatches(b(['012', '034', '021', '032', '145']));
    expect(g[0].special).toBe('rocketH');
  });

  it('5 in a row → rainbow', () => {
    const g = findMatches(b(['000001', '123232', '232323']));
    expect(g[0].special).toBe('rainbow');
    expect(g[0].at).toEqual({ x: 2, y: 0 });
  });

  it('L shape → bomb placed at the corner', () => {
    const g = findMatches(b(['0003', '0121', '0213', '1321']));
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(5);
    expect(g[0].special).toBe('bomb');
    expect(g[0].at).toEqual({ x: 0, y: 0 });
  });

  it('T shape → bomb placed at the intersection', () => {
    const g = findMatches(b(['0001', '2031', '3024', '1312']));
    expect(g[0].special).toBe('bomb');
    expect(g[0].at).toEqual({ x: 1, y: 0 });
  });

  it('+ shape → bomb', () => {
    const g = findMatches(b(['1021', '0003', '2023', '1312']));
    expect(g[0].cells).toHaveLength(5);
    expect(g[0].special).toBe('bomb');
    expect(g[0].at).toEqual({ x: 1, y: 1 });
  });

  it('2×2 square → butterfly', () => {
    const g = findMatches(b(['0012', '0023', '1231']));
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(4);
    expect(g[0].special).toBe('butterfly');
  });

  it('2×3 block is one group → butterfly', () => {
    const g = findMatches(b(['0001', '0002', '1231']));
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(6);
    expect(g[0].special).toBe('butterfly');
  });

  it('separate groups of different colors stay separate', () => {
    const g = findMatches(b(['0001', '1112', '2323']));
    expect(g).toHaveLength(2);
  });

  it('holes, crates, chicks and rainbows break lines', () => {
    expect(findMatches(b(['0#00', '1231']))).toEqual([]);
    expect(findMatches(b(['0c00', '1231']))).toEqual([]);
    expect(findMatches(b(['0o00', '1231']))).toEqual([]);
    expect(findMatches(b(['0*00', '1231']))).toEqual([]);
  });

  it('colored specials match by color', () => {
    const g = findMatches(b(['H001', '1232']));
    expect(g).toHaveLength(1);
    expect(g[0].cells).toHaveLength(3);
  });

  it('prefers the swapped cell for the special', () => {
    const g = findMatches(b(['00001', '12323']), [{ x: 3, y: 0 }]);
    expect(g[0].at).toEqual({ x: 3, y: 0 });
  });

  it('never places a special onto an existing special', () => {
    const g = findMatches(b(['0H001', '12323']), [{ x: 1, y: 0 }]);
    expect(g[0].special).toBe('rocketV');
    expect(g[0].at).not.toEqual({ x: 1, y: 0 });
  });
});

describe('matchSizeAt', () => {
  it('measures lines through a cell', () => {
    const board = b(['0001', '1012', '2023']);
    expect(matchSizeAt(board, 0, 0)).toBe(3);
    expect(matchSizeAt(board, 1, 0)).toBe(5); // row of 3 + column of 3 sharing the cell
    expect(matchSizeAt(board, 3, 0)).toBe(0);
  });
  it('detects squares', () => {
    const board = b(['001', '002', '123']);
    expect(matchSizeAt(board, 1, 1)).toBe(4);
  });
});
