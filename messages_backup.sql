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
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.messages (id, conversation_id, user_id, content, created_at, sender, updated_at, sender_id, context_type, context_id, edited_at, edited_content, deleted_at, deleted_by, read, reply_to_message_id, reply_to_content, reply_to_sender) FROM stdin;
64	106	admin_1751065261945	reply if you receive this pretty please :)	2025-07-21 23:45:01.276286	Katie (Admin) Long	2025-07-21 23:45:01.276286	admin_1751065261945	\N	user_1751072243271_fc8jaxl6u	\N	\N	\N	\N	f	\N	\N	\N
65	106	admin_1751065261945	reply if you receive this pretty please :)	2025-07-21 23:45:03.066496	Katie (Admin) Long	2025-07-21 23:45:03.066496	admin_1751065261945	\N	user_1751072243271_fc8jaxl6u	\N	\N	\N	\N	f	\N	\N	\N
67	106	admin_1751065261945	Testing reply functionality after fixes	2025-07-22 00:00:14.366503	Katie (Admin) Long	2025-07-22 00:00:14.366503	admin_1751065261945	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
68	\N	admin_1751065261945	Test message from authentication fix	2025-07-22 00:31:05.581477	Katie (admin)	2025-07-22 00:31:05.581477	admin_1751065261945	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
70	106	user_1751250351194_sdteqpzz5	hey!\n\n--- Original Message ---\nFrom: Katie (Main) Long <katielong2316@gmail.com>\nDate: 07:23 PM\nSubject: No Subject\n\nhi	2025-07-22 00:39:55.18428	Katie (alternate) Long	2025-07-22 00:39:55.18428	user_1751250351194_sdteqpzz5	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
71	106	admin_1751065261945	testing testing	2025-07-22 00:59:12.297247	Katie (Admin) Long	2025-07-22 00:59:12.297247	admin_1751065261945	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
72	106	admin_1751065261945	This is a test message	2025-07-22 01:21:37.221352	Katie (Admin) Long	2025-07-22 01:21:37.221352	admin_1751065261945	\N	test@example.com	\N	\N	\N	\N	f	\N	\N	\N
74	106	admin_1751065261945	please work\n\n--- Original Message ---\nFrom: Katie (Main) Long <katielong2316@gmail.com>\nDate: 07:23 PM\nSubject: No Subject\n\nhi	2025-07-22 01:26:20.281304	Katie (Admin) Long	2025-07-22 01:26:20.281304	admin_1751065261945	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
75	106	user_1751250351194_sdteqpzz5	b a n a n a s	2025-07-22 01:30:01.362196	Katie (alternate) Long	2025-07-22 01:30:01.362196	user_1751250351194_sdteqpzz5	\N	admin@sandwich.project	\N	\N	\N	\N	f	\N	\N	\N
76	106	user_1751071509329_mrkw2z95z	testing	2025-07-23 02:09:20.842557	Katie (Main) Long	2025-07-23 02:09:20.842557	user_1751071509329_mrkw2z95z	\N	admin@sandwich.project	\N	\N	\N	\N	f	\N	\N	\N
77	\N	user_1751071509329_mrkw2z95z	🎉 Kudos! Great job completing Christine Test Assignment!	2025-07-23 02:54:20.441283	Katie (Main)	2025-07-23 02:54:20.441283	user_1751071509329_mrkw2z95z	task	47	\N	\N	\N	\N	f	\N	\N	\N
79	\N	user_1751071509329_mrkw2z95z	Subject: testing\n\ntest 1	2025-07-23 03:09:21.365272	Katie (Main)	2025-07-23 03:09:21.365272	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
82	\N	admin_1751065261945	🎉 Kudos! Great job completing task completion!	2025-07-23 03:10:18.219465	Katie (admin)	2025-07-23 03:10:18.219465	admin_1751065261945	task	46	\N	\N	\N	\N	f	\N	\N	\N
83	106	user_1751071509329_mrkw2z95z	test	2025-07-23 20:17:18.690576	Katie (Main) Long	2025-07-23 20:17:18.690576	user_1751071509329_mrkw2z95z	\N	admin@sandwich.project	\N	\N	\N	\N	f	\N	\N	\N
84	106	user_1751071509329_mrkw2z95z	456789	2025-07-23 21:30:00.537898	Katie (Main) Long	2025-07-23 21:30:00.537898	user_1751071509329_mrkw2z95z	\N	kenig.ka@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
85	106	user_1751071509329_mrkw2z95z	no it does not	2025-07-23 23:05:15.93081	Katie (Main) Long	2025-07-23 23:05:15.93081	user_1751071509329_mrkw2z95z	\N	kenig.ka@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
90	\N	user_1751071509329_mrkw2z95z	Subject: hey\n\nhey	2025-07-24 02:00:32.992597	Katie (Main)	2025-07-24 02:00:32.992597	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
31	101	user_1751071509329_mrkw2z95z	hi!	2025-07-09 01:41:23.843099	Katie Long	2025-07-09 01:41:23.843099	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
32	102	user_1751071509329_mrkw2z95z	hi!	2025-07-09 01:41:30.317089	Katie Long	2025-07-09 01:41:30.317089	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
33	69	user_1751071509329_mrkw2z95z	hi!	2025-07-09 01:41:34.22351	Katie Long	2025-07-09 01:41:34.22351	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
34	10	user_1751071509329_mrkw2z95z	anyone?	2025-07-09 13:54:45.535903	Katie Long	2025-07-09 13:54:45.535903	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
35	87	admin_1751065261945	📝 Clarification request for your suggestion "Submit your suggestions here!":\n\nDetails?	2025-07-11 21:33:20.239733	Admin User	2025-07-11 21:33:20.239733	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
36	104	user_1751071509329_mrkw2z95z	📝 Clarification request for your suggestion "Submit your suggestions here!":\n\nDetails?	2025-07-11 21:34:36.37908	Katie Long	2025-07-11 21:34:36.37908	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
51	1	admin_1751065261945	test message from curl	2025-07-17 20:47:08.3381	Katie Long (Admin)	2025-07-17 20:47:08.3381	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
61	106	user_1751071509329_mrkw2z95z	hi	2025-07-21 22:57:07.49243	Katie Long	2025-07-21 23:25:59.518305	user_1751071509329_mrkw2z95z	\N	admin_1751065261945	\N	\N	\N	\N	t	\N	\N	\N
62	106	user_1751071509329_mrkw2z95z	hi	2025-07-21 23:23:39.545966	Katie (Main) Long	2025-07-21 23:42:06.707544	user_1751071509329_mrkw2z95z	\N	admin_1751065261945	\N	\N	\N	\N	t	\N	\N	\N
60	106	user_1751250351194_sdteqpzz5	hi	2025-07-21 22:56:02.256895	Katie (alternate) Long	2025-07-21 23:42:09.672584	user_1751250351194_sdteqpzz5	\N	admin_1751065261945	\N	\N	\N	\N	t	\N	\N	\N
106	107	admin_1751065261945	FUCKING FINALLY. Now's the real test.	2025-07-25 00:05:58.637406	Katie (Admin) Long	2025-07-25 00:05:58.637406	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
107	7	user_1751071509329_mrkw2z95z	💫 Wonderful work on undefined! Thanks for your commitment to excellence.	2025-07-25 01:39:24.26987	Katie (Main) Long	2025-07-25 01:39:24.26987	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
66	106	admin_1751065261945	This is a test reply to verify the reply functionality is working correctly.\n\n--- Original Message ---\nFrom: Katie (Main) Long <katielong2316@gmail.com>\nSubject: Test\n\nOriginal message content	2025-07-21 23:47:31.15365	Katie (Admin) Long	2025-07-21 23:47:31.15365	admin_1751065261945	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
63	106	user_1751071509329_mrkw2z95z	hi	2025-07-21 23:23:52.463956	Katie (Main) Long	2025-07-21 23:53:25.256152	user_1751071509329_mrkw2z95z	\N	user_1751250351194_sdteqpzz5	\N	\N	\N	\N	t	\N	\N	\N
69	106	admin_1751065261945	Testing POST endpoint	2025-07-22 00:37:03.452606	Katie (Admin) Long	2025-07-22 00:37:03.452606	admin_1751065261945	\N	admin@sandwich.project	\N	\N	\N	\N	f	\N	\N	\N
73	106	user_1751250351194_sdteqpzz5	is this working or not!?\n\n--- Original Message ---\nFrom: Katie (Main) Long <katielong2316@gmail.com>\nDate: 07:23 PM\nSubject: No Subject\n\nhi	2025-07-22 01:24:24.723692	Katie (alternate) Long	2025-07-22 01:24:24.723692	user_1751250351194_sdteqpzz5	\N	katielong2316@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
78	\N	user_1751071509329_mrkw2z95z	🎉 Kudos! Great job completing task completion!	2025-07-23 02:54:26.532738	Katie (Main)	2025-07-23 02:54:26.532738	user_1751071509329_mrkw2z95z	task	46	\N	\N	\N	\N	f	\N	\N	\N
80	\N	admin_1751065261945	🎉 Kudos! Great job completing Christine Test Assignment!	2025-07-23 03:10:08.450999	Katie (admin)	2025-07-23 03:10:08.450999	admin_1751065261945	task	47	\N	\N	\N	\N	f	\N	\N	\N
81	\N	admin_1751065261945	🎉 Kudos! Great job completing task completion!	2025-07-23 03:10:11.997469	Katie (admin)	2025-07-23 03:10:11.997469	admin_1751065261945	task	46	\N	\N	\N	\N	f	\N	\N	\N
86	\N	user_1751071509329_mrkw2z95z	Subject: testing testing\n\n1 2 3	2025-07-23 23:09:33.874696	Katie (Main)	2025-07-23 23:09:33.874696	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
87	\N	user_1751071509329_mrkw2z95z	Subject: hi\n\nlet me know if this works	2025-07-24 00:26:30.489515	Katie (Main)	2025-07-24 00:26:30.489515	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
88	\N	user_1751071509329_mrkw2z95z	Subject: testing\n\ntesting testing	2025-07-24 00:26:51.360239	Katie (Main)	2025-07-24 00:26:51.360239	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
89	\N	user_1751071509329_mrkw2z95z	🎉 Kudos! Great job completing Submit request in Catchafire!	2025-07-24 01:59:10.623198	Katie (Main)	2025-07-24 01:59:10.623198	user_1751071509329_mrkw2z95z	task	39	\N	\N	\N	\N	f	\N	\N	\N
91	\N	user_1751250351194_sdteqpzz5	🎉 Kudos! Great job completing Submit request in Catchafire!	2025-07-24 02:01:14.112167	Katie (Alternate)	2025-07-24 02:01:14.112167	user_1751250351194_sdteqpzz5	task	39	\N	\N	\N	\N	f	\N	\N	\N
92	\N	user_1751250351194_sdteqpzz5	🎉 Kudos! Great job completing get back first proofs!	2025-07-24 02:02:29.035706	Katie (Alternate)	2025-07-24 02:02:29.035706	user_1751250351194_sdteqpzz5	task	48	\N	\N	\N	\N	f	\N	\N	\N
93	\N	user_1751250351194_sdteqpzz5	🎉 Kudos! Great job completing ask for final edits!	2025-07-24 02:02:32.256106	Katie (Alternate)	2025-07-24 02:02:32.256106	user_1751250351194_sdteqpzz5	task	49	\N	\N	\N	\N	f	\N	\N	\N
94	\N	user_1751250351194_sdteqpzz5	🎉 Kudos! Great job completing close out with Mark!	2025-07-24 02:02:43.829909	Katie (Alternate)	2025-07-24 02:02:43.829909	user_1751250351194_sdteqpzz5	task	50	\N	\N	\N	\N	f	\N	\N	\N
95	\N	user_1751071509329_mrkw2z95z	🎉 Kudos! Great job completing Submit request in Catchafire!	2025-07-24 02:37:29.500795	Katie (Main)	2025-07-24 02:37:29.500795	user_1751071509329_mrkw2z95z	task	39	\N	\N	\N	\N	f	\N	\N	\N
56	106	user_1751071509329_mrkw2z95z	Testing if null contextType resolves the database constraint violation	2025-07-21 18:27:52.207594	Katie Long	2025-07-21 18:27:52.207594	user_1751071509329_mrkw2z95z	\N	kenig.ka@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
57	106	user_1751071509329_mrkw2z95z	Final test to confirm messaging system is fully operational	2025-07-21 18:29:38.797045	Katie Long	2025-07-21 18:29:38.797045	user_1751071509329_mrkw2z95z	\N	kenig.ka@gmail.com	\N	\N	\N	\N	f	\N	\N	\N
96	104	user_1751071509329_mrkw2z95z	testing	2025-07-24 19:45:12.066303	Katie (Main) Long	2025-07-24 19:45:12.066303	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
97	104	user_1751071509329_mrkw2z95z	test 2	2025-07-24 19:55:05.565669	Katie (Main) Long	2025-07-24 19:55:05.565669	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
98	104	admin_1751065261945	test 1	2025-07-24 19:56:44.835947	Katie (Admin) Long	2025-07-24 19:56:44.835947	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
99	104	user_1751071509329_mrkw2z95z	testing	2025-07-24 21:24:26.298343	Katie (Main) Long	2025-07-24 21:24:26.298343	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
100	104	admin_1751065261945	testing	2025-07-24 21:26:30.547551	Katie (Admin) Long	2025-07-24 21:26:30.547551	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
101	104	user_1751071509329_mrkw2z95z	testing	2025-07-24 21:55:34.808288	Katie (Main) Long	2025-07-24 21:55:34.808288	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
102	104	admin_1751065261945	test	2025-07-24 21:55:58.524483	Katie (Admin) Long	2025-07-24 21:55:58.524483	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
103	107	user_1751071509329_mrkw2z95z	test #2	2025-07-24 23:52:44.428842	Katie (Main) Long	2025-07-24 23:52:44.428842	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
104	104	admin_1751065261945	This is a test, hopefully it works.	2025-07-24 23:54:24.200819	Katie (Admin) Long	2025-07-24 23:54:24.200819	admin_1751065261945	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
105	104	user_1751071509329_mrkw2z95z	this is yet another test.	2025-07-24 23:55:05.376169	Katie (Main) Long	2025-07-24 23:55:05.376169	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
108	108	user_1751071509329_mrkw2z95z	✨ Excellent completion of undefined! Your work makes a real difference.	2025-07-25 01:39:28.717221	Katie (Main) Long	2025-07-25 01:39:28.717221	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
109	7	user_1751071509329_mrkw2z95z	⭐ Great job completing undefined! Thanks for your excellent contribution.	2025-08-02 20:11:55.986726	Katie (Main) Long	2025-08-02 20:11:55.986726	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
110	7	user_1751071509329_mrkw2z95z	⭐ Great job completing undefined! Thanks for your excellent contribution.	2025-08-02 20:11:58.57989	Katie (Main) Long	2025-08-02 20:11:58.57989	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
111	107	user_1751071509329_mrkw2z95z	🎉 Fantastic work on Successfully Updated Project Title, Marcy Louza, Katie Long, Katie Long! Your dedication really shows.	2025-08-03 01:59:05.448767	Katie (Main) Long	2025-08-03 01:59:05.448767	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
112	107	user_1751071509329_mrkw2z95z	⭐ Great job completing Giving Circle Grant! Thanks for your excellent contribution.	2025-08-03 01:59:07.80576	Katie (Main) Long	2025-08-03 01:59:07.80576	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
113	107	user_1751071509329_mrkw2z95z	🎉 Fantastic work on Catchafire logo design for Portfolio partnership, Christine Cooper Nowicki! Your dedication really shows.	2025-08-03 01:59:13.562233	Katie (Main) Long	2025-08-03 01:59:13.562233	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
114	107	user_1751071509329_mrkw2z95z	🌟 Brilliant work on Test Sandwich Project Platform! Your contribution is truly appreciated.	2025-08-03 01:59:15.786151	Katie (Main) Long	2025-08-03 01:59:15.786151	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
133	\N	user_1751071509329_mrkw2z95z	Test message from API	2025-08-15 01:54:19.583907	Katie (Main)	2025-08-15 01:54:19.583907	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
115	107	user_1751071509329_mrkw2z95z	⭐ Great job completing Successfully Updated Project Title! Thanks for your excellent contribution.	2025-08-03 02:25:56.426978	Katie (Main) Long	2025-08-03 02:25:56.426978	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
116	107	user_1751071509329_mrkw2z95z	🎯 Awesome job with Giving Circle Grant, Katie Long! Thanks for being such a valuable team member.	2025-08-03 03:01:32.097227	Katie (Main) Long	2025-08-03 03:01:32.097227	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
117	107	user_1751071509329_mrkw2z95z	🎯 Awesome job with Successfully Updated Project Title, Marcy Louza, Katie Long, Katie Long! Thanks for being such a valuable team member.	2025-08-03 03:01:34.185112	Katie (Main) Long	2025-08-03 03:01:34.185112	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
118	107	user_1751071509329_mrkw2z95z	🎯 Awesome job with Test Sandwich Project Platform, Katie Long, Marcy Louza, Stephanie Luis, Christine Cooper Nowicki, Vicki Tropauer, Kimberly Ross! Thanks for being such a valuable team member.	2025-08-03 03:01:35.481214	Katie (Main) Long	2025-08-03 03:01:35.481214	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
119	107	user_1751071509329_mrkw2z95z	✨ Excellent completion of Catchafire logo design for Portfolio partnership! Your work makes a real difference.	2025-08-03 03:01:36.582882	Katie (Main) Long	2025-08-03 03:01:36.582882	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
120	\N	admin_1751065261945	🎉 Fantastic work on improving the kudos system! Your dedication really shows.	2025-08-03 03:35:59.680846	Katie (admin)	2025-08-03 03:35:59.680846	admin_1751065261945	project	28	\N	\N	\N	\N	f	\N	\N	\N
121	\N	user_1751493923615_nbcyq3am7	⭐ Great job on the dark mode fixes! Thanks for your excellent contribution.	2025-08-03 03:35:59.680846	Christine Test User	2025-08-03 03:35:59.680846	user_1751493923615_nbcyq3am7	project	27	\N	\N	\N	\N	f	\N	\N	\N
122	\N	admin_1751065261945	🏆 Outstanding work on Giving Circle Grant, Team Member 1! Keep up the amazing effort.	2025-08-03 04:27:13.72052	Katie (admin)	2025-08-03 04:27:13.72052	admin_1751065261945	project	21	\N	\N	\N	\N	f	\N	\N	\N
123	\N	admin_1751065261945	💫 Wonderful work on Catchafire logo design for Portfolio partnership! Thanks for your commitment to excellence.	2025-08-03 04:28:37.107165	Katie (admin)	2025-08-03 04:28:37.107165	admin_1751065261945	project	18	\N	\N	\N	\N	f	\N	\N	\N
124	\N	admin_1751065261945	💫 Wonderful work on Test Sandwich Project Platform! Thanks for your commitment to excellence.	2025-08-03 04:28:39.490828	Katie (admin)	2025-08-03 04:28:39.490828	admin_1751065261945	project	20	\N	\N	\N	\N	f	\N	\N	\N
125	\N	user_1751071509329_mrkw2z95z	💫 Wonderful work on Catchafire logo design for Portfolio partnership! Thanks for your commitment to excellence.	2025-08-03 04:55:18.336454	Katie (Main)	2025-08-03 04:55:18.336454	user_1751071509329_mrkw2z95z	project	18	\N	\N	\N	\N	f	\N	\N	\N
126	\N	user_1751071509329_mrkw2z95z	🎉 Fantastic work on Successfully Updated Project Title, Admin User! Your dedication really shows.	2025-08-03 04:55:20.092736	Katie (Main)	2025-08-03 04:55:20.092736	user_1751071509329_mrkw2z95z	project	25	\N	\N	\N	\N	f	\N	\N	\N
127	\N	user_1751071509329_mrkw2z95z	✨ Excellent completion of Successfully Updated Project Title! Your work makes a real difference.	2025-08-03 04:55:21.088343	Katie (Main)	2025-08-03 04:55:21.088343	user_1751071509329_mrkw2z95z	project	25	\N	\N	\N	\N	f	\N	\N	\N
128	\N	user_1751071509329_mrkw2z95z	🚀 Amazing job completing Test Sandwich Project Platform, Marcy! Your effort doesn't go unnoticed.	2025-08-03 04:55:22.374922	Katie (Main)	2025-08-03 04:55:22.374922	user_1751071509329_mrkw2z95z	project	20	\N	\N	\N	\N	f	\N	\N	\N
129	\N	user_1751071509329_mrkw2z95z	🎉 Fantastic work on Test Sandwich Project Platform, Stephanie! Your dedication really shows.	2025-08-03 04:55:23.258187	Katie (Main)	2025-08-03 04:55:23.258187	user_1751071509329_mrkw2z95z	project	20	\N	\N	\N	\N	f	\N	\N	\N
130	\N	user_1751071509329_mrkw2z95z	⭐ Great job completing Test Sandwich Project Platform! Thanks for your excellent contribution.	2025-08-03 04:55:24.525669	Katie (Main)	2025-08-03 04:55:24.525669	user_1751071509329_mrkw2z95z	project	20	\N	\N	\N	\N	f	\N	\N	\N
131	\N	user_1751071509329_mrkw2z95z	💫 Wonderful work on Test Sandwich Project Platform! Thanks for your commitment to excellence.	2025-08-03 04:55:25.685724	Katie (Main)	2025-08-03 04:55:25.685724	user_1751071509329_mrkw2z95z	project	20	\N	\N	\N	\N	f	\N	\N	\N
132	\N	user_1751071509329_mrkw2z95z	🎉 Fantastic work on Test Sandwich Project Platform, Kim Ross! Your dedication really shows.	2025-08-03 04:55:26.891045	Katie (Main)	2025-08-03 04:55:26.891045	user_1751071509329_mrkw2z95z	project	20	\N	\N	\N	\N	f	\N	\N	\N
134	\N	user_1751071509329_mrkw2z95z	Subject: Test Gmail Inbox\n\nThis is a test message to verify the Gmail-style inbox is working properly.	2025-08-15 01:54:32.860299	Katie (Main)	2025-08-15 01:54:32.860299	user_1751071509329_mrkw2z95z	direct	\N	\N	\N	\N	\N	f	\N	\N	\N
135	\N	user_1751071509329_mrkw2z95z	test	2025-08-15 02:04:57.405823	Katie (Main)	2025-08-15 02:04:57.405823	user_1751071509329_mrkw2z95z	\N	\N	\N	\N	\N	\N	f	\N	\N	\N
136	\N	admin_1751065261945	🚀 Amazing job completing Catchafire Elevator Speech, Marcy! Your effort doesn't go unnoticed.	2025-08-15 03:15:57.578116	Katie (admin)	2025-08-15 03:15:57.578116	admin_1751065261945	project	26	\N	\N	\N	\N	f	\N	\N	\N
137	\N	admin_1751065261945	⭐ Great job completing Catchafire - Outreach to Corporations! Thanks for your excellent contribution.	2025-08-26 16:34:30.631003	Katie (admin)	2025-08-26 16:34:30.631003	admin_1751065261945	project	27	\N	\N	\N	\N	f	\N	\N	\N
138	\N	admin_1751065261945	💫 Wonderful work on Catchafire Video Creation! Thanks for your commitment to excellence.	2025-08-26 16:34:33.866274	Katie (admin)	2025-08-26 16:34:33.866274	admin_1751065261945	project	22	\N	\N	\N	\N	f	\N	\N	\N
139	\N	admin_1751065261945	💫 Wonderful work on Test Sandwich Project Platform! Thanks for your commitment to excellence.	2025-08-26 16:34:40.06956	Katie (admin)	2025-08-26 16:34:40.06956	admin_1751065261945	project	20	\N	\N	\N	\N	f	\N	\N	\N
140	\N	admin_1751065261945	💫 Wonderful work on Test Sandwich Project Platform! Thanks for your commitment to excellence.	2025-08-26 16:34:41.539723	Katie (admin)	2025-08-26 16:34:41.539723	admin_1751065261945	project	20	\N	\N	\N	\N	f	\N	\N	\N
141	\N	admin_1751065261945	⭐ Great job completing Test Sandwich Project Platform! Thanks for your excellent contribution.	2025-08-26 16:34:43.117528	Katie (admin)	2025-08-26 16:34:43.117528	admin_1751065261945	project	20	\N	\N	\N	\N	f	\N	\N	\N
142	\N	admin_1751065261945	🚀 Amazing job completing Test Sandwich Project Platform, Team Member 6! Your effort doesn't go unnoticed.	2025-08-26 16:34:44.273241	Katie (admin)	2025-08-26 16:34:44.273241	admin_1751065261945	project	20	\N	\N	\N	\N	f	\N	\N	\N
143	\N	admin_1756853839752	🏆 Outstanding work on 495 sandwiches from Dunwoody/PTC, Lisa Hiles! Keep up the amazing effort.	2025-09-04 21:59:09.684631	admin@sandwich.project	2025-09-04 21:59:09.684631	admin_1756853839752	task	3357	\N	\N	\N	\N	f	\N	\N	\N
144	\N	admin_1756853839752	💫 Wonderful work on 1844 sandwiches from Dunwoody/PTC! Thanks for your commitment to excellence.	2025-09-04 21:59:13.146241	admin@sandwich.project	2025-09-04 21:59:13.146241	admin_1756853839752	task	3356	\N	\N	\N	\N	f	\N	\N	\N
145	\N	admin_1756853839752	🏆 Outstanding work on 100 sandwiches from UGA, James Satterfield! Keep up the amazing effort.	2025-09-04 21:59:16.144438	admin@sandwich.project	2025-09-04 21:59:16.144438	admin_1756853839752	task	3358	\N	\N	\N	\N	f	\N	\N	\N
146	\N	admin_1756853839752	🎉 Fantastic work on 65 sandwiches from Dacula, Veronica Pennington! Your dedication really shows.	2025-09-04 21:59:17.972807	admin@sandwich.project	2025-09-04 21:59:17.972807	admin_1756853839752	task	3355	\N	\N	\N	\N	f	\N	\N	\N
147	\N	admin_1756853839752	🚀 Amazing job completing 1391 sandwiches from Dunwoody/PTC, Lisa Hiles! Your effort doesn't go unnoticed.	2025-09-04 22:14:06.069901	admin@sandwich.project	2025-09-04 22:14:06.069901	admin_1756853839752	task	3345	\N	\N	\N	\N	f	\N	\N	\N
148	\N	admin_1756853839752	🎉 Kudos! Great job completing 1099 Driver!	2025-09-09 18:44:16.879251	admin@sandwich.project	2025-09-09 18:44:16.879251	admin_1756853839752	project	47	\N	\N	\N	\N	f	\N	\N	\N
149	\N	admin_1756853839752	🚀 Amazing job completing 321 sandwiches from Sandy Springs/Chastain, Jen Cohen! Your effort doesn't go unnoticed.	2025-09-11 23:49:32.926528	admin@sandwich.project	2025-09-11 23:49:32.926528	admin_1756853839752	task	3360	\N	\N	\N	\N	f	\N	\N	\N
150	\N	admin_1756853839752	🎯 Awesome job with 1005 sandwiches from East Cobb/Roswell, Vicki Tropauer! Thanks for being such a valuable team member.	2025-09-11 23:49:33.919919	admin@sandwich.project	2025-09-11 23:49:33.919919	admin_1756853839752	task	3368	\N	\N	\N	\N	f	\N	\N	\N
151	\N	admin_1756853839752	⭐ Great job completing 308 sandwiches from Dacula! Thanks for your excellent contribution.	2025-09-11 23:49:36.228743	admin@sandwich.project	2025-09-11 23:49:36.228743	admin_1756853839752	task	3364	\N	\N	\N	\N	f	\N	\N	\N
152	\N	admin_1756853839752	✨ Excellent completion of 1094 sandwiches from Alpharetta! Your work makes a real difference.	2025-09-11 23:49:37.094283	admin@sandwich.project	2025-09-11 23:49:37.094283	admin_1756853839752	task	3366	\N	\N	\N	\N	f	\N	\N	\N
153	\N	admin_1756853839752	✨ Excellent completion of 371 sandwiches from Sandy Springs/Chastain! Your work makes a real difference.	2025-09-11 23:49:38.37459	admin@sandwich.project	2025-09-11 23:49:38.37459	admin_1756853839752	task	3365	\N	\N	\N	\N	f	\N	\N	\N
\.


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.messages_id_seq', 153, true);


--
-- PostgreSQL database dump complete
--

