import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(to: str, token: str) -> None:
    if not settings.smtp_host:
        logger.info("SMTP not configured — skipping verification email to %s", to)
        return

    link = f"{settings.frontend_url}?verify={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your PM Dashboard email"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to

    html = f"""
    <p>Welcome to PM Dashboard!</p>
    <p>Click the link below to verify your email address:</p>
    <p><a href="{link}">{link}</a></p>
    <p>If you did not register, ignore this email.</p>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            start_tls=True,
        )
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to, exc)
