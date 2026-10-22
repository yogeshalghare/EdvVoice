"""Transactional email through Resend."""

import httpx
from fastapi import HTTPException

from config import settings

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _shell(title: str, body_html: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#F8F9FD;
               font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#181C1F;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;
               border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(24,28,31,.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#7A1FA2 0%,#FE8A00 100%);
                       padding:28px 32px;color:#ffffff;font-size:20px;font-weight:700;">
              EdvVoice Portal
            </td>
          </tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:22px;">{title}</h1>
            {body_html}
          </td></tr>
          <tr>
            <td style="padding:20px 32px;background:#F8F9FD;font-size:12px;color:#8A90A0;">
              University Grievance System — GHRCE, Nagpur
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _button(href: str, label: str) -> str:
    return (
        f'<a href="{href}" style="display:inline-block;background:#FE8A00;color:#ffffff;'
        f'text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;'
        f'border-radius:12px;">{label}</a>'
    )


async def send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        raise HTTPException(500, "RESEND_API_KEY is missing. Add it to backend/.env and restart.")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.resend_from, "to": [to], "subject": subject, "html": html},
        )

    if response.status_code >= 400:
        try:
            detail = response.json().get("message", response.text)
        except Exception:
            detail = response.text
        raise HTTPException(502, f"Resend rejected the email: {detail}")


async def send_password_reset(to: str, link: str) -> None:
    body = f"""
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4B5563;">
        Use the button below to set a new password. The link works once and
        expires in 30 minutes.
      </p>
      {_button(link, "Set a new password")}
      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#8A90A0;">
        If the button doesn't work, paste this into your browser:<br>
        <span style="color:#7A1FA2;word-break:break-all;">{link}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8A90A0;">
        Didn't ask for this? Ignore this email — your password stays as it is.
      </p>"""
    await send(to, "Reset your EdvVoice password", _shell("Reset your password", body))


async def send_complaint_registered(to: str, reference: str, title: str, category: str) -> None:
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#4B5563;">
        Your complaint has been registered and routed to the {category} department.
        Quote this tracking ID when you follow up.
      </p>
      <p style="margin:0 0 24px;font-size:26px;font-weight:700;color:#7A1FA2;">{reference}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4B5563;">{title}</p>
      {_button(f"{settings.app_url}/app/complaints/{reference}", "Track your complaint")}"""
    await send(to, f"Complaint {reference} registered", _shell("We've got your complaint", body))


async def send_status_change(to: str, reference: str, title: str, status: str) -> None:
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#4B5563;">
        Complaint <strong>{reference}</strong> is now marked <strong>{status}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4B5563;">{title}</p>
      {_button(f"{settings.app_url}/app/complaints/{reference}", "See the details")}"""
    await send(to, f"Complaint {reference} is now {status}", _shell(f"Update on {reference}", body))


async def send_email_otp(to: str, name: str, code: str) -> None:
    body = f"""
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#4B5563;">
        Hello {name}, enter this code on the EdvVoice sign-up page to confirm
        your email. It expires in 10 minutes.
      </p>
      <p style="margin:0 0 24px;font-size:40px;font-weight:700;letter-spacing:10px;
                color:#7A1FA2;font-family:monospace;">{code}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8A90A0;">
        Didn't sign up? Ignore this email and no account will be activated.
        Never share this code with anyone.
      </p>"""
    await send(to, f"{code} is your EdvVoice confirmation code", _shell("Confirm your email", body))
