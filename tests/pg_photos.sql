\set ON_ERROR_STOP 0
\echo '--- Joe makes a player link and a staff link'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select save_share('photophotophotophotoXX','player','pl-9','Beth','{"player":{"name":"Beth"}}','4321',true);
select save_share('staffstaffstaffstaffXX','session','s1','Session','{}','5555',true);
\echo '--- Player adds her photo with her PIN'
reset role; set role anon;
select set_share_photo('photophotophotophotoXX','4321','data:image/jpeg;base64,QUJDRA==')->>'ok' as added;
select open_share('photophotophotophotoXX','4321')->>'photo' as photo_on_her_page;
\echo '--- Wrong PIN, wrong kind of link, not a JPEG, too big: all refused'
select set_share_photo('photophotophotophotoXX','0000','data:image/jpeg;base64,QUJDRA==')->>'reason' as wrong_pin;
select set_share_photo('staffstaffstaffstaffXX','5555','data:image/jpeg;base64,QUJDRA==')->>'reason' as staff_link;
select set_share_photo('photophotophotophotoXX','4321','<script>alert(1)</script>')->>'reason' as not_jpeg;
select set_share_photo('photophotophotophotoXX','4321','data:image/jpeg;base64,'||repeat('A',200001))->>'reason' as too_big;
select set_share_photo('photophotophotophotoXX','4321','data:image/svg+xml;base64,QUJD')->>'reason' as svg;
\echo '--- anon still cannot read the table directly'
select count(*) from shares;
\echo '--- Joe sees it, with a server timestamp'
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select ref_id, left(photo, 23) as photo, photo_at is not null as stamped from shares where kind='player' and token='photophotophotophotoXX';
\echo '--- Joe updates the page: the photo survives'
select save_share('photophotophotophotoXX','player','pl-9','Beth','{"player":{"name":"Beth S"}}',null,true);
select left(photo, 23) as photo_after_joe_update from shares where token='photophotophotophotoXX';
\echo '--- Another coach cannot see or remove it'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as other_sees from shares;
update shares set photo = null where token='photophotophotophotoXX';
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select photo is not null as still_there from shares where token='photophotophotophotoXX';
\echo '--- Player removes it; Joe can also remove one'
reset role; set role anon;
select set_share_photo('photophotophotophotoXX','4321',null)->>'ok' as removed;
reset role; set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select photo is null as gone, photo_at is not null as removal_stamped from shares where token='photophotophotophotoXX';
