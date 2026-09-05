const metricLabels = {
  candidates:'Candidates', scanned:'Titles scanned', estimatedSaving:'Potential saving', confidence:'Confidence',
  titles:'Library titles', libraries:'Libraries', sessions:'Active streams', transcodes:'Transcodes', direct:'Direct play',
  arrivals:'Recent arrivals', issues:'Issues found', missingArtwork:'Missing artwork', missingSummary:'Missing summaries', missingYear:'Missing years',
};

function formatDuration(run) {
  const elapsed = Number.isFinite(run.durationMs) ? run.durationMs : run.finishedAt ? Date.parse(run.finishedAt) - Date.parse(run.startedAt) : null;
  if (elapsed === null || !Number.isFinite(elapsed) || elapsed < 0) return run.status === 'running' ? 'In progress' : 'Duration unavailable';
  if (elapsed < 1000) return `${elapsed} ms`;
  if (elapsed < 60_000) return `${(elapsed / 1000).toFixed(elapsed < 10_000 ? 1 : 0)} sec`;
  const minutes = Math.floor(elapsed / 60_000), seconds = Math.round(elapsed % 60_000 / 1000);
  return `${minutes}m ${seconds}s`;
}

function metricValue(key, value, bytes) {
  if (key === 'estimatedSaving') return bytes(value);
  if (key === 'confidence') return `${value}%`;
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function exactTime(value) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
}

export function renderAutomationReports(runs, { escape, relativeTime, bytes }) {
  if (!runs.length) return '<div class="history-empty">No missions have run yet. Try a dry run to verify a recipe safely.</div>';
  return runs.map((run, index) => {
    const result=run.result || {}, failed=run.status === 'failed';
    const headline=result.headline || run.error || (run.status === 'running' ? 'Mission in progress' : 'Run completed');
    const detail=result.detail || run.error || 'Waiting for the automation core to report back…';
    const trigger=run.dryRun ? 'DRY RUN' : run.trigger === 'schedule' ? 'SCHEDULED' : 'MANUAL';
    const metrics=Object.entries(result.metrics || {});
    const facts=Array.isArray(result.facts) ? result.facts : [];
    const items=Array.isArray(result.items) ? result.items : [];
    const metricsMarkup=metrics.length ? `<div class="run-metric-grid">${metrics.map(([key,value])=>`<article><span>${escape(metricLabels[key] || key.replace(/([A-Z])/g, ' $1'))}</span><strong>${escape(metricValue(key,value,bytes))}</strong></article>`).join('')}</div>` : '';
    const factsMarkup=facts.length ? `<div class="run-facts">${facts.map(fact=>`<div><span>${escape(fact.label)}</span><b>${escape(fact.value)}</b></div>`).join('')}</div>` : '';
    const itemsMarkup=items.length ? `<section class="run-findings"><div class="run-report-label">KEY FINDINGS · SHOWING ${Math.min(items.length,8)}</div>${items.map((item,itemIndex)=>{const paths=Array.isArray(item.paths)&&item.paths.length?item.paths:item.path?[item.path]:[];const pathsMarkup=paths.map((path,pathIndex)=>`<code class="run-finding-path" title="${escape(path)}"><span>${paths.length>1?`PATH ${pathIndex+1}`:"PATH"}</span>${escape(path)}</code>`).join("");return `<div class="run-finding"><span>${String(itemIndex+1).padStart(2,"0")}</span><div><b>${escape(item.title)}</b><small>${escape(item.detail || "No additional detail")}</small>${pathsMarkup}</div><em>${escape(item.value || "")}</em></div>`}).join("")}</section>` : "";
    const recommendation=result.recommendation ? `<aside class="run-recommendation"><span>COMPANION ADVICE</span><p>${escape(result.recommendation)}</p></aside>` : '';
    return `<details class="auto-run-report ${escape(run.status)}" ${index === 0 ? 'open' : ''}>
      <summary><span class="history-status"><i></i>${escape(run.status)}</span><div class="run-summary-title"><b>${escape(run.ruleName)}</b><small>${escape(headline)}</small></div><span class="run-trigger">${trigger}</span><time>${relativeTime(run.finishedAt || run.startedAt)}</time><i class="run-chevron"></i></summary>
      <div class="run-report-body"><div class="run-outcome"><span class="run-report-label">${failed ? 'FAILURE REPORT' : run.dryRun ? 'PREVIEW OUTCOME' : 'RUN OUTCOME'}</span><h3>${escape(headline)}</h3><p>${escape(detail)}</p></div>${metricsMarkup}${factsMarkup}${itemsMarkup}${recommendation}<footer><span>Started <b>${escape(exactTime(run.startedAt))}</b></span><span>Completed in <b>${escape(formatDuration(run))}</b></span><span>Trigger <b>${trigger}</b></span><span>Run ID <b>${escape(String(run.id || '').slice(0,8) || 'Legacy')}</b></span></footer></div>
    </details>`;
  }).join('');
}
