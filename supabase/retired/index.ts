// Reversible retirement for remote endpoints that the connector cannot delete.
// No authentication, database, image processing or paid provider is invoked.
Deno.serve(() => new Response(JSON.stringify({
  error: 'This legacy endpoint has been retired. Refresh Neighborhood Garage to use the current app.',
  code: 'endpoint_retired',
}), {
  status: 410,
  headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'},
}));
