import {
  findVariant,
  initialSelection,
  isStale,
  regenerate,
  suggestSku,
  valueState,
} from '../src/utils/variants';
import type {Variant} from '../src/types';

const v = (
  id: string,
  options: Record<string, string>,
  stock: number,
): Variant => ({
  id,
  sku: null,
  options,
  price: null,
  stock,
  is_active: true,
});

const options = [
  {name: 'Color', values: ['Rojo', 'Azul']},
  {name: 'Talla', values: ['S', 'M']},
];
const variants = [
  v('rs', {Color: 'Rojo', Talla: 'S'}, 0),
  v('rm', {Color: 'Rojo', Talla: 'M'}, 2),
  v('as', {Color: 'Azul', Talla: 'S'}, 1),
];

describe('picking a variant', () => {
  it('finds the variant only once every option is chosen', () => {
    expect(findVariant(variants, options, {Color: 'Rojo'})).toBeNull();
    expect(
      findVariant(variants, options, {Color: 'Rojo', Talla: 'M'})?.id,
    ).toBe('rm');
  });

  it('opens on the first variant that is in stock', () => {
    expect(initialSelection(variants)).toEqual({Color: 'Rojo', Talla: 'M'});
  });

  it('marks values that lead nowhere or are sold out', () => {
    expect(
      valueState(variants, options, {Color: 'Azul'}, 'Talla', 'M'),
    ).toEqual({exists: false, inStock: false});
    expect(
      valueState(variants, options, {Color: 'Rojo'}, 'Talla', 'S'),
    ).toEqual({exists: true, inStock: false});
  });
});

describe('editing variants (admin)', () => {
  const drafts = [
    {name: 'Color', valuesText: 'Rojo, Azul'},
    {name: 'Talla', valuesText: 'S'},
  ];

  it('builds every combination and suggests SKUs', () => {
    const rows = regenerate('Camisa Básica', drafts, []);
    expect(rows.map(r => r.sku)).toEqual(['CAM-ROJ-S', 'CAM-AZU-S']);
    expect(
      suggestSku('Camisa Básica', [{name: 'Color'}], {Color: 'Rojo'}),
    ).toBe('CAM-ROJ');
  });

  it('keeps stock and ids of combinations that still exist', () => {
    const kept = {
      id: 'x',
      options: {Color: 'Rojo', Talla: 'S'},
      sku: 'MINE',
      price: '',
      stock: '7',
      is_active: true,
    };
    const rows = regenerate('Camisa', drafts, [kept]);
    expect(rows[0]).toBe(kept);
    expect(rows).toHaveLength(2);
  });

  it('flags rows that no longer match the options', () => {
    const row = {
      options: {Color: 'Verde', Talla: 'S'},
      sku: '',
      price: '',
      stock: '0',
      is_active: true,
    };
    expect(isStale(drafts, row)).toBe(true);
    expect(
      isStale(drafts, {...row, options: {Color: 'Rojo', Talla: 'S'}}),
    ).toBe(false);
  });
});
