-- Editable email template for the proposal acceptance and travel information link.
insert into public.travel_email_templates (email_code,email_name,subject,body_html)
values (
 'proposal_acceptance',
 'Proposal Acceptance & Travel Information',
 'Your Travel Proposal Is Ready for Approval | Inspired Vacations',
 '<div>Hi {{first_name}},</div><div><br></div><div>We are getting closer to making your {{destination}} vacation a reality!</div><div><br></div><div>Your travel proposal is ready for your approval. Before we move ahead with booking, please review and accept the proposal and deposit agreement, then confirm your preferred travel suppliers and rewards or loyalty information.</div><div><br></div><div><a href="{{secure_form_url}}">Review &amp; Accept Your Travel Proposal</a></div><div><br></div><div>Once you have completed both steps, we will coordinate your deposit and move forward with your reservations.</div><div><br></div><div>If you have any questions, just reply to this email.</div><div><br></div><div>Cheers,</div><div>{{advisor_first_name}} &amp; the Inspired Vacations Team</div>'
)
on conflict (email_code) do nothing;
