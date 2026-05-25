/**
 * Learn-hub article registry.
 */

import { LEARN_ARTICLE } from './content-model.js';

const ARTICLE_MODELS = new Map([[LEARN_ARTICLE.id, LEARN_ARTICLE]]);

const ARTICLE_SUMMARIES = Object.freeze([
  {
    id: 'learn',
    titleKey: LEARN_ARTICLE.titleKey,
    subtitleKey: LEARN_ARTICLE.subtitleKey,
    icon: LEARN_ARTICLE.icon,
    metadata: LEARN_ARTICLE.metadata,
    modelReady: true,
  },
  {
    id: 'methodology',
    titleKey: 'method-h1',
    subtitleKey: 'method-sub',
    icon: '🔬',
    metadata: {
      readTime: 10,
      lastUpdated: '2026-05-25',
      category: 'methodology',
    },
    modelReady: false,
  },
  {
    id: 'insights',
    titleKey: 'insights-h1',
    subtitleKey: 'insights-sub',
    icon: '📊',
    metadata: {
      readTime: 6,
      lastUpdated: '2026-05-25',
      category: 'insights',
    },
    modelReady: false,
  },
]);

const SUMMARY_MAP = new Map(ARTICLE_SUMMARIES.map((summary) => [summary.id, summary]));

const RELATED_GRAPH = Object.freeze({
  learn: ['methodology', 'insights'],
  methodology: ['learn', 'insights'],
  insights: ['learn', 'methodology'],
});

export function getArticle(slug) {
  if (!slug) return null;
  return ARTICLE_MODELS.get(slug) ?? null;
}

export function listArticles(category) {
  if (!category) return ARTICLE_SUMMARIES.map((summary) => ({ ...summary }));
  return ARTICLE_SUMMARIES.filter((summary) => summary.metadata?.category === category).map(
    (summary) => ({ ...summary })
  );
}

export function getRelatedArticles(slug) {
  return (RELATED_GRAPH[slug] ?? []).map((id) => SUMMARY_MAP.get(id)).filter(Boolean);
}
