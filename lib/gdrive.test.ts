import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAssets } from './gdrive.ts';

const named = (...names: string[]) => names.map((name) => ({ name }));

describe('classifyAssets', () => {
  test('finds a video by extension', () => {
    const { video } = classifyAssets(named('cat.png', 'clip.MP4'));
    assert.equal(video?.name, 'clip.MP4');
  });

  test('finds a video by mime type when the extension is unknown', () => {
    const { video } = classifyAssets([{ name: 'render', mimeType: 'video/quicktime' }]);
    assert.equal(video?.name, 'render');
  });

  test('prefers a name-matched params image over positional fallback', () => {
    const { staticImg, paramsImg } = classifyAssets(named('a.png', 'b.png', 'my_parameters.png'));
    assert.equal(paramsImg?.name, 'my_parameters.png');
    assert.equal(staticImg?.name, 'a.png');
  });

  test('falls back to the second image as params when no name matches', () => {
    const { staticImg, paramsImg } = classifyAssets(named('first.jpg', 'second.jpg'));
    assert.equal(staticImg?.name, 'first.jpg');
    assert.equal(paramsImg?.name, 'second.jpg');
  });

  test('the only PNG is the params screenshot, whatever the order', () => {
    for (const names of [['IMG_4667.JPG', 'IMG_5447.PNG'], ['IMG_5447.PNG', 'IMG_4667.JPG']]) {
      const { staticImg, paramsImg } = classifyAssets(named(...names));
      assert.equal(paramsImg?.name, 'IMG_5447.PNG');
      assert.equal(staticImg?.name, 'IMG_4667.JPG');
    }
  });

  test('the phone-shaped image is the params screenshot, even among PNGs', () => {
    const files = [
      { name: 'a.png', width: 1170, height: 2532 },
      { name: 'b.png', width: 3024, height: 4032 },
    ];
    for (const order of [files, [...files].reverse()]) {
      const { staticImg, paramsImg } = classifyAssets(order);
      assert.equal(paramsImg?.name, 'a.png');
      assert.equal(staticImg?.name, 'b.png');
    }
  });

  test('shape beats file type when they disagree', () => {
    const { paramsImg } = classifyAssets([
      { name: 'shot.jpg', width: 1170, height: 2532 },
      { name: 'still.png', width: 1440, height: 1920 },
    ]);
    assert.equal(paramsImg?.name, 'shot.jpg');
  });

  test('a lone image is the preview, not the params shot', () => {
    const { staticImg, paramsImg } = classifyAssets(named('only.png'));
    assert.equal(staticImg?.name, 'only.png');
    assert.equal(paramsImg, undefined);
  });

  test('a lone params-named image leaves no preview', () => {
    const { staticImg, paramsImg } = classifyAssets(named('params.png'));
    assert.equal(paramsImg?.name, 'params.png');
    assert.equal(staticImg, undefined);
  });

  test('ignores files that are neither video nor image', () => {
    const { video, staticImg, paramsImg } = classifyAssets(named('notes.txt', 'data.json'));
    assert.equal(video, undefined);
    assert.equal(staticImg, undefined);
    assert.equal(paramsImg, undefined);
  });

  // The invariant worth protecting: one file must never fill both image slots.
  test('never assigns the same file to preview and params', () => {
    for (const names of [['a.png'], ['a.png', 'b.png'], ['params.png', 'a.png'], ['a.png', 'b.png', 'c.png']]) {
      const { staticImg, paramsImg } = classifyAssets(named(...names));
      if (staticImg && paramsImg) {
        assert.notEqual(staticImg.name, paramsImg.name, `collision for [${names}]`);
      }
    }
  });
});
