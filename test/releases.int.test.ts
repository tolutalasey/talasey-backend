import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReleaseService } from '../src/content/release.service.js';
import { databaseUrl, signIn, startApi } from './support/app.js';

const run = Date.now().toString(36);

const guide = (slug: string, seoTitle = 'How to plan a garden lighting scheme | Talasey') => ({
  title: `Guide ${slug}`,
  slug,
  topic: 'Planning',
  answer: 'Plan the cable runs first, then place each light where it does a job.',
  steps: ['Plan the cable runs', 'Fit the lights'],
  body: 'First paragraph.\n\nSecond paragraph.',
  author: { name: 'Sam Patel', role: 'Technical team' },
  publishedOn: '2026-11-01',
  seo: {
    title: seoTitle,
    description:
      'How to plan garden lighting: where the cable runs, which lights to use and where, from our technical team.',
  },
});

describe.skipIf(!databaseUrl)('content releases', () => {
  let app: NestExpressApplication;
  let editor: string;
  let contributor: string;
  const http = () => request(app.getHttpServer());
  const live = async () =>
    ((await http().get('/store/content/guide').expect(200)).body as { slug: string }[]).map(
      (entry) => entry.slug,
    );

  const draft = async (slug: string, seoTitle?: string) =>
    (
      await http()
        .post('/content/documents')
        .set('authorization', editor)
        .send({ type: 'guide', data: guide(slug, seoTitle) })
        .expect(201)
    ).body as { id: string };

  const newRelease = async (name: string) =>
    (await http().post('/content/releases').set('authorization', editor).send({ name }).expect(201))
      .body as { id: string };

  const add = (releaseId: string, documentId: string) =>
    http()
      .post(`/content/releases/${releaseId}/items`)
      .set('authorization', editor)
      .send({ documentId });

  beforeAll(async () => {
    app = await startApi();
    editor = await signIn(app, 'editor');
    contributor = await signIn(app, 'contributor');
  });

  afterAll(() => app?.close());

  it('keeps releases to people who can publish', async () => {
    await http().get('/content/releases').set('authorization', contributor).expect(403);
  });

  it('publishes everything in a release together, or nothing', async () => {
    const ready = await draft(`ready-${run}`);
    const unfinished = await draft(`unfinished-${run}`, 'Too short');
    const release = await newRelease(`Spring sale ${run}`);
    await add(release.id, ready.id).expect(200);
    await add(release.id, unfinished.id).expect(200);

    const { body: failure } = await http()
      .post(`/content/releases/${release.id}/publish`)
      .set('authorization', editor)
      .expect(422);
    expect(failure.message.join(' ')).toContain('search title');
    expect(await live()).not.toContain(`ready-${run}`);

    await http()
      .put(`/content/documents/${unfinished.id}`)
      .set('authorization', editor)
      .send({ data: guide(`unfinished-${run}`) })
      .expect(200);
    const { body: published } = await http()
      .post(`/content/releases/${release.id}/publish`)
      .set('authorization', editor)
      .expect(200);
    expect(published.status).toBe('published');
    expect(await live()).toEqual(expect.arrayContaining([`ready-${run}`, `unfinished-${run}`]));
  });

  it('goes live on its own at the scheduled time', async () => {
    const later = await draft(`later-${run}`);
    const release = await newRelease(`Monday launch ${run}`);
    await add(release.id, later.id).expect(200);

    const publishAt = new Date(Date.now() + 60 * 60_000);
    await http()
      .post(`/content/releases/${release.id}/schedule`)
      .set('authorization', editor)
      .send({ publishAt: new Date(Date.now() - 60_000).toISOString() })
      .expect(422);
    const { body: scheduled } = await http()
      .post(`/content/releases/${release.id}/schedule`)
      .set('authorization', editor)
      .send({ publishAt: publishAt.toISOString() })
      .expect(200);
    expect(scheduled).toMatchObject({ status: 'scheduled', scheduledBy: 'Ed Editor' });

    const releases = app.get(ReleaseService);
    await releases.publishDue(new Date(publishAt.getTime() - 1000));
    expect(await live()).not.toContain(`later-${run}`);
    await releases.publishDue(new Date(publishAt.getTime() + 1000));
    expect(await live()).toContain(`later-${run}`);
  });

  it('keeps a document in one waiting release at a time, and reopens a release when it changes', async () => {
    const page = await draft(`shared-${run}`);
    const first = await newRelease(`First ${run}`);
    const second = await newRelease(`Second ${run}`);
    await add(first.id, page.id).expect(200);
    await add(second.id, page.id).expect(422);

    await http()
      .post(`/content/releases/${first.id}/schedule`)
      .set('authorization', editor)
      .send({ publishAt: new Date(Date.now() + 60 * 60_000).toISOString() })
      .expect(200);
    const { body: reopened } = await http()
      .delete(`/content/releases/${first.id}/items/${page.id}`)
      .set('authorization', editor)
      .expect(200);
    expect(reopened).toMatchObject({ status: 'open', publishAt: null, items: [] });
  });
});
