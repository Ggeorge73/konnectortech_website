// Version 1 content lives in Markdown and JSON files under /content. This module reads them at build time.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import company from '../../content/company.json';
import frontierData from '../../content/frontier.json';
import { IS_PRODUCTION } from './site';

const ROOT = path.join(process.cwd(), 'content');

export type Service = {
  slug: string;
  order: number;
  title: string;
  short: string; // name used on panels
  summary: string; // the one sentence from the current site
  core?: boolean;
  covers: string[];
  description: string; // meta description
  html: string;
};

export type ProofRecord = {
  slug: string;
  order: number;
  title: string;
  sector: 'public' | 'private';
  clientType: string;
  gap: string;
  connected: string;
  result: string;
  number: string; // the one number, e.g. "14 weeks"
  numberLabel: string;
  individualExperience?: boolean; // a principal's own record, not a company project
  draft?: boolean; // awaiting real content from Konnector: never published in a production build
  html: string;
};

function readDir<T>(dir: string): (T & { slug: string; html: string })[] {
  const full = path.join(ROOT, dir);
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(full, file), 'utf8'));
      return { ...(data as T), slug: file.replace(/\.md$/, ''), html: marked.parse(content, { async: false }) as string };
    });
}

// Draft items are shown (clearly stamped) in preview builds so layouts can be reviewed,
// and are removed from production builds so no placeholder or invented proof can go live.
const live = <T extends { draft?: boolean }>(items: T[]) => (IS_PRODUCTION ? items.filter((i) => !i.draft) : items);

export const getServices = () => readDir<Service>('services').sort((a, b) => a.order - b.order);
export const getService = (slug: string) => getServices().find((s) => s.slug === slug);

export const getProof = () => live(readDir<ProofRecord>('proof')).sort((a, b) => a.order - b.order);
export const getProofRecord = (slug: string) => getProof().find((p) => p.slug === slug);

export type Fact = { label: string; value: string; draft?: boolean };
export type Person = { name: string; role: string; bio: string; photo?: string; draft?: boolean };

export const credentials = live(company.credentials as Fact[]);
export const registrations = live(company.registrations as Fact[]);
export const naicsCodes = live(company.naicsCodes as Fact[]);
export const contractRoutes = live(company.contractRoutes as Fact[]);
export const people = live(company.people as Person[]);

// Frontier technologies Konnector helps customers integrate (content/frontier.json). Konnector is the integrator.
export type FrontierItem = { key: string; company: string; product: string; url: string; what: string; fitPublic: string; fitPrivate: string; steps: [string, string][]; draft?: boolean };
export const frontier = live(frontierData.items as FrontierItem[]);
