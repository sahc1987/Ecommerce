/**
 * @format
 */

import React, {act} from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer?.toJSON()).toBeTruthy();
});
