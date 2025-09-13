--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (84ade85)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.conversations (id, type, name, created_at) FROM stdin;
1	channel	General Chat	2025-07-06 17:04:29.074747
2	channel	Core Team	2025-07-06 17:04:29.074747
3	channel	Marketing Committee	2025-07-06 17:04:29.074747
4	channel	Host Chat	2025-07-06 17:04:29.074747
5	channel	Driver Chat	2025-07-06 17:04:29.074747
6	channel	Recipient Chat	2025-07-06 17:04:29.074747
7	direct	\N	2025-07-06 17:04:31.961639
10	group	Giving Circle	2025-07-06 17:04:32.715077
11	group	Allstate Grant	2025-07-06 17:04:32.715077
87	direct	admin_1751065261945_user_1751493923615_nbcyq3am7	2025-07-08 23:04:05.913601
88	direct	admin_1751065261945_user_1751072243271_fc8jaxl6u	2025-07-08 23:13:02.672843
99	channel	Marketing Committee	2025-07-09 00:27:03.717489
100	direct	user_1751071509329_mrkw2z95z_user_1751920534988_2cgbrae86	2025-07-09 01:41:20.529424
101	direct	user_1751071509329_mrkw2z95z_user_1751072243271_fc8jaxl6u	2025-07-09 01:41:22.158073
102	direct	user_1751071509329_mrkw2z95z_user_1751492211973_0pi1jdl3p	2025-07-09 01:41:27.477549
104	direct	Direct Message	2025-07-11 21:34:36.142368
105	direct	Test Direct Message	2025-07-16 16:56:28.353568
106	channel	general	2025-07-21 18:24:09.221821
107	channel	team-chat	2025-07-24 23:52:44.248575
69	direct	user_1751071509329_mrkw2z95z_user_1751493923615_nbcyq3am7	2025-07-07 02:18:04.666899
108	direct	\N	2025-07-25 01:39:28.556506
\.


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.conversations_id_seq', 108, true);


--
-- PostgreSQL database dump complete
--

