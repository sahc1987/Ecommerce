import React, {act} from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Image} from 'react-native';
import {ProductImage} from '../src/components/ProductImage';

const render = async (element: React.ReactElement) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
};

const placeholder = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(node => node.props.accessibilityRole === 'image');

describe('ProductImage', () => {
  it('shows the photo, fitted (not cropped)', async () => {
    const r = await render(<ProductImage src="/uploads/mouse.png" alt="MX Master 3S" />);
    const img = r.root.findByType(Image);
    expect(img.props.resizeMode).toBe('contain');
    expect(img.props.source.uri).toMatch(/\/uploads\/mouse\.png$/);
    expect(img.props.accessibilityLabel).toBe('MX Master 3S');
  });

  it('shows a labelled placeholder when there is no photo', async () => {
    const r = await render(<ProductImage src={null} alt="Sony WH-1000XM5" category="Audio" />);
    expect(r.root.findAllByType(Image)).toHaveLength(0);
    expect(placeholder(r)[0].props.accessibilityLabel).toBe('Sony WH-1000XM5, no photo yet');
  });

  it('falls back to the placeholder when the photo fails to load', async () => {
    const r = await render(<ProductImage src="/uploads/missing.png" alt="Sonos Arc" />);
    await act(async () => {
      r.root.findByType(Image).props.onError();
    });
    expect(r.root.findAllByType(Image)).toHaveLength(0);
    expect(placeholder(r)).not.toHaveLength(0);
  });
});
