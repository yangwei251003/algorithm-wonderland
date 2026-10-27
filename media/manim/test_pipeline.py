import copy
import json
from pathlib import Path
import tempfile
import unittest
from film_contract import load_package,spoken_lines,event_scene
from visuals import css_color,display
from tts import caption_cues
from film_runtime import replay_representatives,explanation_pages,TraceFilm,operation_key,allocate_readable_pages,event_modes,result_name

BASE=Path(__file__).resolve().parent


class PipelineContractTest(unittest.TestCase):
    def test_bootstrap_mean_is_not_labelled_as_the_running_sum(self):
        p=load_package(BASE.parent/'exports/bootstrap.film.json')
        events=p['run']['trace']['events']
        average=next(e for e in events if e['phase']=='statistic')
        draw=events[int(average['id'])-1]
        self.assertEqual(draw['calculation']['result'],56)
        self.assertEqual(average['calculation']['result'],14)
        self.assertEqual(result_name(draw),'累计和')
        self.assertEqual(result_name(average),'重采样均值')

    def test_authored_comparison_is_not_demoted_to_compact_replay(self):
        event={'id':'4','ruleId':'compare','explanation':'已发现，同样代价无需再次入队。'}
        self.assertEqual(event_modes(event,{'id':'why','pageModes':['comparison']},{operation_key(event)},4,1),['comparison:0'])

    def test_metadata_event_preserves_a_previous_real_swap_scene(self):
        p=load_package(BASE.parent/'exports/quick-sort.film.json')
        run=p['run']
        self.assertEqual(event_scene(run['trace']['events'][5],run)['values'],[2,5,7,2,4])
        self.assertEqual(event_scene(run['trace']['events'][9],run)['values'],[2,2,7,5,4])

    def test_explicit_reading_hold_has_its_own_caption(self):
        cues=caption_cues({'text':'先计算。','start':0,'speechEnd':2,'end':5,'words':[]})
        self.assertEqual(cues[0]['end'],2)
        self.assertEqual(cues[-1],{'text':'停一停，核对画面里的这组计算。','start':2,'end':5})

    def test_new_rule_has_reading_time_amid_a_fast_replay(self):
        pages=[({'id':str(i)},'rule:0' if i==75 else 'compact',3 if i==75 else 1,True) for i in range(150)]
        shown,frames=allocate_readable_pages(pages,18,60)
        self.assertEqual(sum(frames),1080)
        self.assertTrue(all(n>=90 for p,n in zip(shown,frames) if p[1]!='compact'))
        self.assertIn(pages[75],shown);self.assertLess(len(shown),len(pages))

    def test_an_overfull_chapter_requires_authored_reading_hold(self):
        with self.assertRaisesRegex(ValueError,'explicit reading hold'):
            allocate_readable_pages([({'id':str(i)},'rule:0',3,True) for i in range(12)],14.5,60)

    def test_replay_never_skips_a_new_operation_within_an_existing_rule(self):
        events=[{'id':str(i),'ruleId':'schedule','calculation':{'formula':'read' if i!=17 else 'rotate+xor'}} for i in range(100)]
        shown=replay_representatives(events,8,{('schedule','read')})
        self.assertIn(events[17],shown)
        self.assertEqual(shown[0],events[0]);self.assertEqual(shown[-1],events[-1])

    def test_comparison_contains_a_rejected_alternative_among_many_winners(self):
        event={'candidates':[{'target':str(i),'status':'chosen' if i<4 else 'rejected'} for i in range(8)]}
        shown=TraceFilm.comparison_candidates(None,event,{})
        self.assertTrue(any(c['status']=='chosen' for c in shown));self.assertTrue(any(c['status']=='rejected' for c in shown))
        self.assertLessEqual(len(shown),3)

    def test_explanation_pagination_preserves_every_character(self):
        original='先检查当前条件，'+('然后依据相同规则继续。'*20)+'最后回溯结果。'
        pages=explanation_pages(original)
        self.assertEqual(''.join(pages),original);self.assertTrue(all(len(p)<=60 for p in pages))

    def altered(self, change):
        data=json.loads((BASE/"smoke/film.json").read_text(encoding="utf-8"))
        change(data)
        with tempfile.TemporaryDirectory(dir=BASE) as folder:
            path=Path(folder)/"film.json"
            path.write_text(json.dumps(data,ensure_ascii=False),encoding="utf-8")
            return load_package(path)

    def test_real_trace_replay(self):
        package=load_package(BASE/"smoke/film.json")
        self.assertEqual(package["run"]["trace"]["finalState"]["score"],7)

    def test_tampered_before_state_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"state mismatch"):
            self.altered(lambda p:p["run"]["trace"]["events"][0]["changes"][0].update(before=42))

    def test_missing_rule_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"Unknown rule"):
            self.altered(lambda p:p["lesson"].update(rules=[]))

    def test_tagged_infinity_preserved(self):
        p=self.altered(lambda p:p["run"]["frames"][0]["scene"].update(matrix=[[{"$number":"Infinity"}]]))
        self.assertEqual(display(p["run"]["frames"][0]["scene"]["matrix"][0][0]),"∞")

    def test_pronunciation_keeps_original_subtitles(self):
        p=load_package(BASE/"smoke/film.json")
        p["beats"][0]["text"]="A* 与 Dijkstra"
        p["pronunciations"]={"A*":"A星","Dijkstra":"迪杰斯特拉"}
        line=spoken_lines(p)[0]
        self.assertEqual(line["text"],"A星 与 迪杰斯特拉")
        self.assertEqual(line["caption"],"A* 与 Dijkstra")

    def test_css_visual_colors(self):
        self.assertEqual(css_color("hsl(0 100% 50%)"),"#FF0000")
        self.assertEqual(css_color("rgba(255,255,255,0)"),"#08131F")

    def test_caption_final_word_does_not_jump_to_start(self):
        cues=caption_cues({"text":"一，二，三。","start":10,"end":13,"words":[{"text":"一","start":10},{"text":"二三","start":11}]})
        self.assertEqual([cue["start"] for cue in cues],[10,11])
        self.assertEqual("".join(cue["text"] for cue in cues),"一，二，三。")
        self.assertTrue(all(cue["end"]>=cue["start"] for cue in cues))


if __name__=="__main__":unittest.main()
