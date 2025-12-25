import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { password } = await request.json();
        const adminPassword = import.meta.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return new Response(
                JSON.stringify({ success: false, message: '服务器未配置管理员密码' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (password === adminPassword) {
            return new Response(
                JSON.stringify({ success: true, message: '验证成功' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ success: false, message: '密码错误' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (e) {
        return new Response(
            JSON.stringify({ success: false, message: '请求格式错误' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
