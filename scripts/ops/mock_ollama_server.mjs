#!/usr/bin/env node
import http from 'node:http';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('body_too_large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function inferIntent(promptText) {
  const prompt = String(promptText || '');
  if (/strict ModelTable patch planner/i.test(prompt)) {
    return {
      response: JSON.stringify({
        proposal: {
          summary: 'Plan label changes and wait for confirmation before apply.',
          operations: [
            { summary: 'Set Model 100 title to "Prompt FillTable Demo"', op: 'add_label', model_id: 100, p: 0, r: 0, c: 0, k: 'title', t: 'str' },
            { summary: 'Remove obsolete_key from Model 100', op: 'rm_label', model_id: 100, p: 0, r: 0, c: 0, k: 'obsolete_key' },
          ],
          queries: [
            { summary: 'Check current status label on Model 100', target: 'model 100 status' },
          ],
          requires_confirmation: true,
          confirmation_question: 'Please confirm apply for these label operations.',
        },
        records: [
          {
            op: 'add_label',
            model_id: 100,
            p: 0,
            r: 0,
            c: 0,
            k: 'title',
            t: 'str',
            v: 'Prompt FillTable Demo',
          },
          {
            op: 'rm_label',
            model_id: 100,
            p: 0,
            r: 0,
            c: 0,
            k: 'obsolete_key',
          },
        ],
        confidence: 0.91,
        reasoning: 'mock filltable planner',
      }),
    };
  }

  if (/scene context updater/i.test(prompt)) {
    return {
      response: JSON.stringify({
        active_flow: 'docs_flow',
        flow_step: 1,
        session_vars_patch: { llm_scene_enriched: true },
      }),
    };
  }

  const lineMatch = prompt.match(/Input action:\s*(.+)/i);
  const action = lineMatch && lineMatch[1] ? lineMatch[1].trim().toLowerCase() : '';
  if (action.includes('ambiguous')) {
    return {
      response: JSON.stringify({
        matched_action: 'docs_search',
        confidence: 0.42,
        reasoning: 'ambiguous intent',
        candidates: ['docs_search', 'docs_refresh_tree'],
      }),
    };
  }
  if (action.includes('refresh') && action.includes('doc')) {
    return {
      response: JSON.stringify({
        matched_action: 'docs_refresh_tree',
        confidence: 0.93,
        reasoning: 'refresh docs index',
        candidates: ['docs_refresh_tree', 'docs_search'],
      }),
    };
  }
  if (action.includes('open') && action.includes('doc')) {
    return {
      response: JSON.stringify({
        matched_action: 'docs_open_doc',
        confidence: 0.89,
        reasoning: 'open selected doc',
        candidates: ['docs_open_doc', 'docs_search'],
      }),
    };
  }
  return {
    response: JSON.stringify({
      matched_action: '',
      confidence: 0.1,
      reasoning: 'no clear match',
      candidates: ['docs_refresh_tree'],
    }),
  };
}

const port = Number.parseInt(process.argv[2] || process.env.MOCK_OLLAMA_PORT || '11435', 10);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  if (req.method === 'GET' && url.pathname === '/api/tags') {
    writeJson(res, 200, { models: [{ name: 'mt-label' }] });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    try {
      const body = await readJsonBody(req);
      const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'mt-label';
      const { response } = inferIntent(body.prompt);
      writeJson(res, 200, {
        model,
        response,
        done: true,
        total_duration: 2000000,
        eval_duration: 1000000,
      });
    } catch (err) {
      writeJson(res, 400, { error: String(err && err.message ? err.message : err) });
    }
    return;
  }
  writeJson(res, 404, { error: 'not_found' });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`[mock-ollama] listening on 127.0.0.1:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
