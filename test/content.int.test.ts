import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseUrl, signIn, startApi } from './support/app.js';

const slug = `garden-lighting-${Date.now().toString(36)}`;
const guide = {
  title: 'How to light a garden path',
  slug,
  topic: 'Planning',
  answer: 'Use low deck lights every metre or so, on a timer, facing down the path.',
  steps: ['Plan where the cable runs', 'Fit the lights'],
  body: 'First paragraph.\n\nSecond paragraph.',
  author: { name: 'Sam Patel', role: 'Technical team' },
  publishedOn: '2026-11-01',
  seo: {
    title: 'How to light a garden path safely | Talasey',
    description:
      'Where to put deck lights along a garden path, how far apart, and how to run the cable safely, from our technical team.',
  },
};

const png = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000002000000010080600000000000000',
  'hex',
);

describe.skipIf(!databaseUrl)('content and publishing', () => {
  let app: NestExpressApplication;
  let contributor: string;
  let editor: string;
  const http = () => request(app.getHttpServer());
  const publishedGuides = async () =>
    (await http().get('/store/content/guide').expect(200)).body as {
      slug: string;
      title: string;
    }[];

  beforeAll(async () => {
    app = await startApi();
    contributor = await signIn(app, 'contributor');
    editor = await signIn(app, 'editor');
  });

  afterAll(() => app?.close());

  it('lets a contributor draft a guide but not publish it, and an editor publish it', async () => {
    const { body: draft } = await http()
      .post('/content/documents')
      .set('authorization', contributor)
      .send({ type: 'guide', data: { ...guide, seo: { title: 'Too short', description: '' } } })
      .expect(201);
    expect(draft.status).toBe('draft');
    expect(draft.canPublish).toBe(false);
    expect(draft.problems).toContain('Make the search title at least 30 characters (now 9)');

    await http()
      .post(`/content/documents/${draft.id}/publish`)
      .set('authorization', contributor)
      .expect(403);
    await http()
      .post(`/content/documents/${draft.id}/publish`)
      .set('authorization', editor)
      .expect(422);
    expect((await publishedGuides()).some((entry) => entry.slug === slug)).toBe(false);

    await http()
      .put(`/content/documents/${draft.id}`)
      .set('authorization', contributor)
      .send({ data: guide })
      .expect(200);
    const { body: published } = await http()
      .post(`/content/documents/${draft.id}/publish`)
      .set('authorization', editor)
      .expect(200);
    expect(published).toMatchObject({
      status: 'published',
      publishedBy: 'Ed Editor',
      problems: [],
    });
    expect((await publishedGuides()).find((entry) => entry.slug === slug)?.title).toBe(guide.title);
  });

  it('keeps the published copy on the site while a new draft is worked on, and can restore it', async () => {
    const { body: list } = await http()
      .get('/content/documents')
      .query({ type: 'guide' })
      .set('authorization', editor);
    const id = list.find((entry: { key: string }) => entry.key === slug).id;

    const { body: changed } = await http()
      .put(`/content/documents/${id}`)
      .set('authorization', contributor)
      .send({ data: { ...guide, title: 'A new title in progress' } })
      .expect(200);
    expect(changed.status).toBe('changed');
    expect((await publishedGuides()).find((entry) => entry.slug === slug)?.title).toBe(guide.title);

    const { body: log } = await http()
      .get('/admin/audit')
      .query({ subject: 'content', subjectId: id })
      .set('authorization', editor)
      .expect(200);
    await http().post(`/admin/audit/${log[0].id}/restore`).set('authorization', editor).expect(200);
    const { body: restored } = await http()
      .get(`/content/documents/${id}`)
      .set('authorization', editor);
    expect(restored.draft.title).toBe(guide.title);
  });

  it('refuses a second guide at the same address', async () => {
    await http()
      .post('/content/documents')
      .set('authorization', contributor)
      .send({ type: 'guide', data: guide })
      .expect(422);
  });

  it('leaves legal wording to the owner to publish', async () => {
    const { body } = await http()
      .post('/content/documents')
      .set('authorization', editor)
      .send({
        type: 'legal',
        data: {
          key: `returns-${Date.now().toString(36)}`,
          title: 'Returns',
          body: 'You can return unused items within 30 days.',
          approvedBy: 'Amy',
          approvedOn: '2026-11-10',
        },
      })
      .expect(201);
    expect(body.canPublish).toBe(false);
    await http()
      .post(`/content/documents/${body.id}/publish`)
      .set('authorization', editor)
      .expect(403);
    const owner = await signIn(app, 'owner');
    await http()
      .post(`/content/documents/${body.id}/publish`)
      .set('authorization', owner)
      .expect(200);
  });

  it('keeps catalogue staff out of content', async () => {
    const catalogue = await signIn(app, 'catalogue');
    await http().get('/content/types').set('authorization', catalogue).expect(403);
  });

  it('takes photos only, and serves them back', async () => {
    const { body } = await http()
      .post('/admin/uploads')
      .set('authorization', contributor)
      .attach('file', png, 'path.png')
      .expect(201);
    expect(body).toMatchObject({
      width: 32,
      height: 16,
      url: expect.stringMatching(/^\/uploads\/.+\.png$/),
    });
    await http().get(body.url).expect(200).expect('content-type', 'image/png');

    await http()
      .post('/admin/uploads')
      .set('authorization', contributor)
      .attach('file', Buffer.from('<svg/>'), 'evil.svg')
      .expect(422);
  });
});
