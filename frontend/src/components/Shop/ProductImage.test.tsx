import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProductImage from './ProductImage';

describe('ProductImage', () => {
  it('shows the photo, lazily by default', () => {
    render(<ProductImage src="/uploads/mouse.png" alt="MX Master 3S" />);
    const img = screen.getByRole('img', { name: 'MX Master 3S' });
    expect(img.tagName).toBe('IMG');
    // mediaUrl() may prefix the API origin (when VITE_API_URL is absolute).
    expect(img.getAttribute('src')).toMatch(/\/uploads\/mouse\.png$/);
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('loads the main image first when marked as priority', () => {
    render(<ProductImage src="/uploads/mouse.png" alt="MX Master 3S" size="large" priority />);
    expect(screen.getByRole('img').getAttribute('loading')).toBe('eager');
  });

  it('shows a neutral placeholder when there is no photo', () => {
    render(<ProductImage src={null} alt="Sony WH-1000XM5" category="Audio" />);
    const placeholder = screen.getByRole('img', { name: 'Sony WH-1000XM5, no photo yet' });
    expect(placeholder.tagName).toBe('DIV');
    expect(screen.getByText('Photo coming soon')).toBeTruthy();
  });

  it('keeps thumbnails text-free', () => {
    render(<ProductImage alt="Cable" size="thumb" />);
    expect(screen.queryByText('Photo coming soon')).toBeNull();
  });

  it('falls back to the placeholder when the file fails, and retries a new one', () => {
    const { rerender } = render(<ProductImage src="/uploads/missing.png" alt="Sonos Arc" />);
    fireEvent.error(screen.getByRole('img', { name: 'Sonos Arc' }));
    expect(screen.getByRole('img', { name: 'Sonos Arc, no photo yet' })).toBeTruthy();

    rerender(<ProductImage src="/uploads/sonos.png" alt="Sonos Arc" />);
    expect(screen.getByRole('img', { name: 'Sonos Arc' }).tagName).toBe('IMG');
  });
});
