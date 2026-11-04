-- Notificación por correo de citas nuevas y modificadas.
-- Requiere:
--   1. Extensión pg_net (Supabase la incluye).
--   2. Un secreto en Vault llamado resend_api_key.
--   3. Opcional: resend_from y booking_notify_to.
--
-- El correo se envía a jaazielbarber09@gmail.com por defecto.
-- Si falta la API key, la cita se guarda igual y solo se emite un warning.

begin;

create extension if not exists pg_net;

create or replace function public.html_escape(p_value text)
returns text
language sql
immutable
as $$
  select replace(
           replace(
             replace(
               replace(
                 replace(coalesce(p_value, ''), '&', '&amp;'),
               '<', '&lt;'),
             '>', '&gt;'),
           '"', '&quot;'),
         '''', '&#39;');
$$;

create or replace function public.format_cop(p_value integer)
returns text
language sql
immutable
as $$
  select '$ ' || replace(to_char(coalesce(p_value, 0), 'FM999G999G999'), ',', '.');
$$;

create or replace function public.notify_booking_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  v_key       text;
  v_from      text;
  v_to        text := 'jaazielbarber09@gmail.com';
  v_event     text;
  v_subject   text;
  v_change    text := '';
  v_status    text;
  v_old_status text;
  v_when      text;
  v_old_when  text;
  v_html      text;
  v_text      text;
begin
  -- Secretos. Si Vault no está disponible, no se bloquea la cita.
  begin
    select decrypted_secret into v_key
      from vault.decrypted_secrets
     where name = 'resend_api_key'
     limit 1;

    select decrypted_secret into v_from
      from vault.decrypted_secrets
     where name = 'resend_from'
     limit 1;

    select decrypted_secret into v_to
      from vault.decrypted_secrets
     where name = 'booking_notify_to'
     limit 1;
  exception when others then
    raise warning 'No se pudo leer Vault: %', sqlerrm;
    return new;
  end;

  if coalesce(btrim(v_key), '') = '' then
    raise warning 'Falta el secreto resend_api_key; no se envía el correo de la cita.';
    return new;
  end if;

  if coalesce(btrim(v_from), '') = '' then
    v_from := 'Jaazi Barber <onboarding@resend.dev>';
  end if;

  if coalesce(btrim(v_to), '') = '' then
    v_to := 'jaazielbarber09@gmail.com';
  end if;

  v_status := case new.status
                when 'confirmed' then 'Confirmada'
                when 'completed' then 'Completada'
                when 'cancelled' then 'Cancelada'
                else new.status
              end;
  v_when := to_char(new.date, 'DD/MM/YYYY') || ' · ' || to_char(new.time, 'HH24:MI');

  if tg_op = 'INSERT' then
    v_event := 'Nueva cita';
    v_change := 'Reserva creada desde la web.';
  else
    v_old_status := case old.status
                      when 'confirmed' then 'Confirmada'
                      when 'completed' then 'Completada'
                      when 'cancelled' then 'Cancelada'
                      else old.status
                    end;
    v_old_when := to_char(old.date, 'DD/MM/YYYY') || ' · ' || to_char(old.time, 'HH24:MI');

    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      v_event := 'Cita cancelada';
      v_change := 'Estado: ' || v_old_status || ' → ' || v_status || '.';
    elsif new.status = 'completed' and old.status is distinct from 'completed' then
      v_event := 'Cita completada';
      v_change := 'Estado: ' || v_old_status || ' → ' || v_status || '.';
    elsif (new.date, new.time) is distinct from (old.date, old.time) then
      v_event := 'Cita reprogramada';
      v_change := 'Antes: ' || v_old_when || '. Ahora: ' || v_when || '.';
    else
      v_event := 'Cita actualizada';
      v_change := 'Se actualizaron los datos de la cita.';
    end if;
  end if;

  v_subject := v_event || ' · ' || new.service_name || ' · ' || v_when;

  v_html := format(
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#171210">' ||
    '<h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 8px">%s</h2>' ||
    '<p style="margin:0 0 18px;color:#555">%s</p>' ||
    '<table style="width:100%%;border-collapse:collapse;font-size:14px">' ||
    '<tr><td style="padding:8px 0;color:#777">Servicio</td><td style="padding:8px 0;text-align:right"><strong>%s</strong></td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Fecha y hora</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Duración</td><td style="padding:8px 0;text-align:right">%s min</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Precio</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Estado</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Cliente</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Teléfono</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Correo</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#777">Código</td><td style="padding:8px 0;text-align:right">%s</td></tr>' ||
    '</table>' ||
    '<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #ddd;font-size:13px;color:#555">%s</p>' ||
    '</div>',
    public.html_escape(v_event),
    public.html_escape(v_change),
    public.html_escape(new.service_name),
    public.html_escape(v_when),
    new.duration,
    public.html_escape(public.format_cop(new.price)),
    public.html_escape(v_status),
    public.html_escape(new.name),
    public.html_escape(new.phone),
    public.html_escape(coalesce(nullif(btrim(new.email), ''), '—')),
    public.html_escape(new.code),
    public.html_escape(
      case
        when coalesce(btrim(new.notes), '') = '' then 'Sin notas.'
        else 'Notas: ' || new.notes
      end
    )
  );

  v_text := v_event || chr(10) || chr(10) ||
    'Servicio: ' || new.service_name || chr(10) ||
    'Fecha y hora: ' || v_when || chr(10) ||
    'Duración: ' || new.duration || ' min' || chr(10) ||
    'Precio: ' || public.format_cop(new.price) || chr(10) ||
    'Estado: ' || v_status || chr(10) ||
    'Cliente: ' || new.name || chr(10) ||
    'Teléfono: ' || new.phone || chr(10) ||
    'Correo: ' || coalesce(nullif(btrim(new.email), ''), '—') || chr(10) ||
    'Código: ' || new.code || chr(10) ||
    'Cambio: ' || v_change || chr(10) ||
    'Notas: ' || coalesce(nullif(btrim(new.notes), ''), '—');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', v_from,
      'to', jsonb_build_array(v_to),
      'subject', v_subject,
      'html', v_html,
      'text', v_text
    )
  );

  return new;
exception when others then
  raise warning 'No se pudo encolar el correo de la cita: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_booking_email() from public;
revoke all on function public.html_escape(text) from public;
revoke all on function public.format_cop(integer) from public;

drop trigger if exists booking_email_notify on public.bookings;
create trigger booking_email_notify
after insert or update of status, date, time, service_name, price, duration, name, phone, email, notes
on public.bookings
for each row
execute function public.notify_booking_email();

commit;
