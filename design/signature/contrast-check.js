// Inspect actual rendered text against its painted solid background. No dependency.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const study = await context.newPage();
  const results = [];
  try {
    for (const direction of ['a', 'b', 'c']) {
      for (const screen of ['dashboard', 'pain', 'notes', 'detail']) {
        await study.goto(`http://127.0.0.1:8080/design/signature/?direction=${direction}&screen=${screen}&capture=1`);
        await study.locator('#main > section').waitFor();
        const measurements = await study.evaluate(() => {
          const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
          const luminance = color => color.map(value => value / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
            .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
          return [...document.querySelectorAll('main *, header *, footer *')]
            .filter(element => element.getClientRects().length && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && !['INPUT', 'SCRIPT', 'STYLE'].includes(element.tagName))
            .map(element => {
              const style = getComputedStyle(element);
              let ancestor = element, background;
              while (ancestor) {
                background = getComputedStyle(ancestor).backgroundColor;
                if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') break;
                ancestor = ancestor.parentElement;
              }
              const text = luminance(rgb(style.color)), surface = luminance(rgb(background));
              const ratio = (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05);
              const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
              return { text: element.textContent.slice(0, 40), ratio, minimum: large ? 3 : 4.5 };
            });
        });
        const failures = measurements.filter(value => value.ratio < value.minimum);
        if (failures.length) throw new Error(`${direction}/${screen}: ${JSON.stringify(failures)}`);
        results.push({ direction, screen, minimumRatio: Math.min(...measurements.map(value => value.ratio)), passed: true });
      }
    }
    return results;
  } finally { await context.close(); }
}
