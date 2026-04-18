import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, inviteLink, orgName, role } = await req.json();

    console.log("Sending email to:", to);
    console.log("API Key exists:", !!RESEND_API_KEY);

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
          <h2 style="color: #1a1a1a;">You've been invited to join ${orgName}</h2>
          <p style="color: #666; font-size: 15px;">
            You have been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong>.
          </p>
          <a href="${inviteLink}" 
             style="display: inline-block; margin-top: 1rem; padding: 12px 24px; 
                    background: #4f46e5; color: white; text-decoration: none; 
                    border-radius: 8px; font-weight: 500;">
            Accept Invite
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 2rem;">
            This invite expires in 24 hours.
          </p>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "RBAC App <onboarding@resend.dev>",
        to,
        subject: `You've been invited to join ${orgName}`,
        html,
      }),
    });

    const data = await res.json();
    console.log("Resend status:", res.status);
    console.log("Resend response:", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.log("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});