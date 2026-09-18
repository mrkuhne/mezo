-- The other S9.7 slice's ~1 hour on main wrote a now-retired "result" key inside
-- ai_message.tool_calls[].calls[]. Read-tolerant (@JsonIgnoreProperties) is not enough: the
-- 90-day retention promise lives on ai_message.tool_outcomes only, and an unscrubbed copy here
-- would silently outlive that scrub forever. Strip it, preserving element order.
-- jsonb_exists(..) rather than the `?` operator on purpose: Liquibase hands the SQL to
-- JDBC, which reads a bare `?` as a bind placeholder and fails with "syntax error at or
-- near $1". The function form is the same operator without that collision.
update ai_message
   set tool_calls = jsonb_set(
           tool_calls,
           '{calls}',
           (select coalesce(jsonb_agg(elem - 'result' order by ord), '[]'::jsonb)
              from jsonb_array_elements(tool_calls -> 'calls') with ordinality as t(elem, ord)))
 where jsonb_exists(tool_calls, 'calls')
   and exists (select 1 from jsonb_array_elements(tool_calls -> 'calls') e where jsonb_exists(e, 'result'));
