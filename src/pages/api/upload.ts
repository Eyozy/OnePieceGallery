import type { APIRoute } from 'astro';
import { Octokit } from 'octokit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetch as undici_fetch, ProxyAgent } from 'undici';

export const prerender = false;

// Simple slugify function
function createSlug(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { imageUrl, title, author, originalUrl } = body;

        if (!imageUrl || !title) {
            return new Response(JSON.stringify({ message: 'Missing required fields' }), { status: 400 });
        }

        const slug = `${createSlug(title)}-${Date.now()}`;
        const imageFilename = `${slug}.jpg`;

        const proxy = import.meta.env.HTTPS_PROXY || process.env.HTTPS_PROXY;
        console.log('[upload] HTTPS_PROXY from import.meta.env:', import.meta.env.HTTPS_PROXY);
        console.log('[upload] HTTPS_PROXY from process.env:', process.env.HTTPS_PROXY);
        console.log('[upload] Using proxy:', proxy || 'NONE');
        const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

        // Headers to avoid 403 Forbidden on image download
        const headers = {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        };

        // Download Image using undici's fetch directly (supports dispatcher properly)
        console.log('[upload] Downloading image from:', imageUrl);
        const imageResponse = await undici_fetch(imageUrl, { headers, dispatcher });
        console.log('[upload] Image response status:', imageResponse.status, imageResponse.statusText);

        if (!imageResponse.ok) {
            console.error('[upload] Failed to download image. Status:', imageResponse.status);
            throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        // Prepare Markdown Content
        const markdownContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "Image by ${author}"
image: "../../assets/images/uploads/${imageFilename}"
originalUrl: "${originalUrl}"
author: "${author}"
date: ${new Date().toISOString()}
---
`;

        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER || process.env.GITHUB_OWNER;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO;

        // STRATEGY: GitHub API if configured, else Local FS
        if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
            const octokit = new Octokit({ auth: GITHUB_TOKEN });

            // Get the current commit SHA of the default branch
            const { data: ref } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                ref: 'heads/main',
            });
            const latestCommitSha = ref.object.sha;

            // Get the tree SHA from the latest commit
            const { data: commit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                commit_sha: latestCommitSha,
            });
            const baseTreeSha = commit.tree.sha;

            // Create blob for the image
            const { data: imageBlob } = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                content: base64Image,
                encoding: 'base64',
            });

            // Create blob for the markdown
            const { data: mdBlob } = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                content: Buffer.from(markdownContent).toString('base64'),
                encoding: 'base64',
            });

            // Create a new tree with both files
            const { data: newTree } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                base_tree: baseTreeSha,
                tree: [
                    {
                        path: `src/assets/images/uploads/${imageFilename}`,
                        mode: '100644',
                        type: 'blob',
                        sha: imageBlob.sha,
                    },
                    {
                        path: `src/content/gallery/${slug}.md`,
                        mode: '100644',
                        type: 'blob',
                        sha: mdBlob.sha,
                    },
                ],
            });

            // Create a new commit
            const { data: newCommit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                message: `feat(gallery): add ${title}`,
                tree: newTree.sha,
                parents: [latestCommitSha],
            });

            // Update the reference to point to the new commit
            await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                ref: 'heads/main',
                sha: newCommit.sha,
            });

            return new Response(JSON.stringify({ message: 'Saved to GitHub successfully! Site rebuild triggered.' }), { status: 200 });

        } else {
            // Local Filesystem Fallback (for local dev)
            if (import.meta.env.PROD) {
                return new Response(JSON.stringify({ message: 'GITHUB_TOKEN not configured for production environment.' }), { status: 500 });
            }

            const projectRoot = process.cwd();
            const assetsDir = path.join(projectRoot, 'src/assets/images/uploads');
            const contentDir = path.join(projectRoot, 'src/content/gallery');

            await fs.mkdir(assetsDir, { recursive: true });
            await fs.mkdir(contentDir, { recursive: true });

            await fs.writeFile(path.join(assetsDir, imageFilename), buffer);
            await fs.writeFile(path.join(contentDir, `${slug}.md`), markdownContent);

            return new Response(JSON.stringify({ message: 'Saved to local filesystem.' }), { status: 200 });
        }

    } catch (error: unknown) {
        console.error('[upload] Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ message: 'Error processing upload', error: errorMessage }), { status: 500 });
    }
};
