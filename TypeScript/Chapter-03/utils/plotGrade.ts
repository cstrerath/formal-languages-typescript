import { display } from "tslab";

export function plotGradeFunction(
  markFn: (maxPoints: number, points: number) => number,
  maxPoints: number,
  options: {
    width?: number;
    height?: number;
    title?: string;
  } = {}
): void {
  const width = options.width ?? 800;
  const height = options.height ?? 500;
  const padding = 60;
  const title = options.title ?? `Grade as a Function of Points (Max Points = ${maxPoints})`;

  // Generate data points
  const chartData = Array.from({ length: maxPoints + 1 }, (_, i) => ({
    x: i,
    y: markFn(maxPoints, i)
  }));

  // Scale functions
  const xScale = (x: number) => padding + (x / maxPoints) * (width - 2 * padding);
  const yScale = (y: number) => height - padding - ((y - 1) / 4) * (height - 2 * padding);

  // Build SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: white;">`;

  // Horizontal grid lines
  for (let grade = 1.0; grade <= 5.0; grade += 0.5) {
    const y = yScale(grade);
    svg += `<line x1="${padding}" y1="${y}" x2="${width-padding}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`;
    svg += `<text x="${padding - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#666">${grade.toFixed(1)}</text>`;
  }

  // Vertical grid lines (every 10 points)
  for (let pts = 0; pts <= maxPoints; pts += 10) {
    const x = xScale(pts);
    svg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height-padding}" stroke="#e0e0e0" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${height-padding + 20}" text-anchor="middle" font-size="12" fill="#666">${pts}</text>`;
  }

  // Axes
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height-padding}" stroke="black" stroke-width="2"/>`;
  svg += `<line x1="${padding}" y1="${height-padding}" x2="${width-padding}" y2="${height-padding}" stroke="black" stroke-width="2"/>`;

  // Plot line
  const pathData = chartData.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(d.x)} ${yScale(d.y)}`
  ).join(' ');
  svg += `<path d="${pathData}" fill="none" stroke="#1f77b4" stroke-width="2"/>`;

  // Data points (every 5 points)
  chartData.forEach((d, i) => {
    if (i % 5 === 0) {
      svg += `<circle cx="${xScale(d.x)}" cy="${yScale(d.y)}" r="4" fill="#1f77b4" stroke="white" stroke-width="1"/>`;
    }
  });

  // Labels
  svg += `<text x="${width/2}" y="${height-10}" text-anchor="middle" font-size="14" font-weight="bold">Points</text>`;
  svg += `<text x="15" y="${height/2}" text-anchor="middle" font-size="14" font-weight="bold" transform="rotate(-90, 15, ${height/2})">Grade</text>`;
  svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">${title}</text>`;

  svg += `</svg>`;
  display.html(svg);
}