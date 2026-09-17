import React from 'react';
// A common 360 × 560 coordinate system lets the contour follow content height.
const contours = {
 connection:'M32 1H328Q359 1 359 32V190C359 210 341 214 341 230S359 250 359 270V518Q359 559 318 559H26Q1 559 1 534V270C1 250 19 246 19 230S1 210 1 190V32Q1 1 32 1Z',
 progression:'M35 1H277C322 1 359 35 359 88V507Q359 559 307 559H31Q1 559 1 529V67Q1 1 35 1Z',
 reflection:'M48 1H312Q359 1 359 48V479C359 530 337 559 295 559H61C20 559 1 530 1 491V48Q1 1 48 1Z',
};
export function ContourSurface({variant='reflection'}) {
 return <svg className={`sig-surface-shape sig-contour-${variant}`} viewBox="0 0 360 560" preserveAspectRatio="none" aria-hidden="true"><path d={contours[variant]}/>{variant==='reflection' && <path className="sig-contour-fold" d="M25 521Q180 555 335 521"/>}</svg>;
}
