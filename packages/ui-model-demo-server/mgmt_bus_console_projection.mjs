const MODEL_ROUTE_KEYS = [
  'mgmt_bus_console_send_route',
  'mgmt_bus_console_refresh_route',
];

const MBR_ROUTE_KEYS = [
  'mbr_route_100',
  'mbr_route_1010',
  'mbr_route_1019',
  'mbr_route_default',
];

function describeModelRoute(routeKey, value) {
  const route = Array.isArray(value) ? value[0] : null;
  const from = Array.isArray(route?.from) ? route.from : [];
  const to = Array.isArray(route?.to) ? route.to : [];
  return {
    route: String(from[1] || routeKey),
    status: to.length > 0 ? 'configured' : 'missing',
    target: to.map((entry) => (
      Array.isArray(entry) ? `${entry[0]}.${entry[1]}` : String(entry)
    )).join(', '),
  };
}

function describeMbrRoute(routeKey, value) {
  return {
    route: routeKey,
    status: value && typeof value === 'object' ? 'configured' : 'missing',
    target: value && typeof value === 'object'
      ? `pin=${String(value.pin || '')}`
      : '',
  };
}

export function deriveMgmtBusConsoleProjection({ matrixProjection, readRootLabel } = {}) {
  const readLabel = typeof readRootLabel === 'function' ? readRootLabel : () => undefined;
  const source = matrixProjection && typeof matrixProjection === 'object' ? matrixProjection : {};
  const selected = String(source.selected || 'trace');
  const subjects = (Array.isArray(source.subjects) ? source.subjects : []).map((entry) => {
    const value = String(entry?.value || '');
    return {
      label: String(entry?.label || value),
      value,
      status: value === selected ? 'selected' : 'available',
    };
  });
  const modelRoutes = MODEL_ROUTE_KEYS.map((routeKey) => (
    describeModelRoute(routeKey, readLabel(0, routeKey))
  ));
  const mbrRoutes = MBR_ROUTE_KEYS.map((routeKey) => (
    describeMbrRoute(routeKey, readLabel(-10, routeKey))
  ));
  const routeRows = [...modelRoutes, ...mbrRoutes];
  const configuredRoutes = routeRows.filter((row) => row.status === 'configured').length;
  const routeStatus = routeRows.length > 0 && configuredRoutes === routeRows.length ? 'live' : 'route_missing';
  const timelineText = [
    'Mgmt Bus Console live projection',
    String(source.readinessText || ''),
    String(source.traceSummaryText || ''),
  ].filter(Boolean).join('\n');
  const inspectorText = [
    `selected=${selected}`,
    String(source.subjectSummaryText || ''),
    `routes=${configuredRoutes}/${routeRows.length}`,
  ].filter(Boolean).join('\n');

  return {
    subjects,
    timelineText,
    inspectorText,
    routeRows,
    routeStatus,
  };
}
