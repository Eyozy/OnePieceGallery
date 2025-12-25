import type { APIRoute } from 'astro';
import * as cheerio from 'cheerio';
import { fetch as undici_fetch, ProxyAgent } from 'undici';

export const prerender = false;

// Convert Twitter/X URL to vxtwitter for better OG tags
function getVxTwitterUrl(originalUrl: string): string | null {
    const twitterPatterns = [
        /https?:\/\/(www\.)?twitter\.com\//,
        /https?:\/\/(www\.)?x\.com\//,
    ];

    for (const pattern of twitterPatterns) {
        if (pattern.test(originalUrl)) {
            return originalUrl.replace(pattern, 'https://vxtwitter.com/');
        }
    }
    return null;
}

// Convert Instagram URL to ddinstagram for better OG tags / image extraction
function getDdInstagramUrl(originalUrl: string): string | null {
    const instagramPatterns = [
        /https?:\/\/(www\.)?instagram\.com\//,
    ];

    for (const pattern of instagramPatterns) {
        if (pattern.test(originalUrl)) {
            return originalUrl.replace(pattern, 'https://ddinstagram.com/');
        }
    }
    return null;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { url } = await request.json();
        if (!url) {
            return new Response(JSON.stringify({ message: 'URL is required' }), { status: 400 });
        }

        const headers = {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        };

        const proxy = import.meta.env.HTTPS_PROXY || process.env.HTTPS_PROXY;
        const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

        // For Twitter/X links, use vxtwitter.com for better media extraction
        // For Instagram links, use ddinstagram.com for better media extraction
        const vxUrl = getVxTwitterUrl(url);
        const ddUrl = getDdInstagramUrl(url);
        const fetchUrl = vxUrl || ddUrl || url;

        console.log('[preview] Original URL:', url);
        console.log('[preview] Fetch URL:', fetchUrl);

        const response = await undici_fetch(fetchUrl, { headers, dispatcher });
        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract image - vxtwitter returns actual media in og:image
        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('meta[name="twitter:image:src"]').attr('content') ||
            $('link[rel="image_src"]').attr('href') || '';

        // Extract title & author
        const ogDescription = $('meta[property="og:description"]').attr('content') || '';
        const ogTitle = $('meta[property="og:title"]').attr('content') || '';
        const pageTitle = $('title').text() || '';
        const siteName = $('meta[property="og:site_name"]').attr('content') || '';

        let title = 'Untitled';
        let author = 'Unknown';

        // For vxtwitter, the title format is usually "Username (@handle)"
        // Or for original Twitter: "Name (@handle) on X"
        // Best approach: extract username from original URL path
        const twitterUrlMatch = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status/);
        const instagramUrlMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);

        if (twitterUrlMatch) {
            author = twitterUrlMatch[1]; // Extract username from URL path

            if (ogDescription && ogDescription.length > 3) {
                // Remove hashtags and clean up the text
                title = ogDescription
                    .replace(/#\w+/g, '')  // Remove hashtags
                    .replace(/\s+/g, ' ')   // Normalize whitespace
                    .trim();

                if (!title) {
                    title = `Tweet by @${author}`;
                }
            } else {
                title = `Tweet by @${author}`;
            }
        } else if (instagramUrlMatch) {
            // For Instagram posts, try to extract author from OG title or URL
            const igTitleMatch = ogTitle.match(/(@?[a-zA-Z0-9_.]+)/);
            if (igTitleMatch) {
                author = igTitleMatch[1].replace('@', '');
            } else {
                author = instagramUrlMatch[1];
            }

            // Use OG description as title, or fallback
            if (ogDescription && ogDescription.length > 3) {
                title = ogDescription
                    .replace(/#\w+/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!title) {
                    title = `Post by @${author}`;
                }
            } else {
                title = ogTitle || `Post by @${author}`;
            }
        } else {
            // Fallback to OG title parsing for other sites
            const handleMatch = ogTitle.match(/@([a-zA-Z0-9_]+)/);
            if (handleMatch) {
                author = handleMatch[1];
                title = ogDescription || `Tweet by @${author}`;
            } else {
                title = ogDescription || ogTitle || pageTitle || 'Untitled';
                author = $('meta[name="author"]').attr('content') || siteName || 'Unknown';
            }
        }

        console.log('[preview] Extracted image:', image);
        console.log('[preview] Title:', title);
        console.log('[preview] Author:', author);

        if (!image) {
            return new Response(JSON.stringify({
                isError: true,
                message: 'Could not extract image. Please enter manually.',
                originalUrl: url,
                imageUrl: '',
                title: title !== 'Untitled' ? title : '',
                author: author !== 'Unknown' ? author.replace('@', '') : ''
            }), { status: 200 });
        }

        return new Response(JSON.stringify({
            originalUrl: url, // Keep original URL for the gallery link
            imageUrl: image,
            title,
            author: author.replace('@', '')
        }), { status: 200 });

    } catch (error) {
        console.error('Preview fetch error:', error);
        return new Response(JSON.stringify({
            isError: true,
            message: 'Failed to fetch metadata (Network/Proxy issue). Please enter details manually.',
            originalUrl: '',
            imageUrl: '',
            title: '',
            author: ''
        }), { status: 200 });
    }
};
