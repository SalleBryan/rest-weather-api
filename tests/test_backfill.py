import json
import sys
from decimal import Decimal
from pathlib import Path
from runpy import run_path
main = run_path(str(Path(__file__).resolve().parent.parent / 'scripts' / 'backfill_search.py'))['main']


def test_migration_is_resumable_preserves_values_and_can_stage_catalog(api,tmp_path,monkeypatch):
    table=api.modules['create_weather'].table
    table.put_item(Item={'id':'legacy','town':'Buea','weather':'Cold',
                        'temperatureC':Decimal('21.5'),'createdAt':'2026-11-01T00:00:00Z'})
    args=['backfill_search','--table',table.name,'--region','us-east-2','--backup']
    first=tmp_path/'first.jsonl'
    monkeypatch.setattr(sys,'argv',args+[str(first),'--no-catalog'])
    main()
    assert json.loads(first.read_text())['temperatureC']=={'N':'21.5'}
    assert len(api.call('get_weathers')[1]['items'])==1
    assert api.call('get_weathers',path='/locations')[1]['items']==[]
    monkeypatch.setattr(sys,'argv',args+[str(tmp_path/'second.jsonl')])
    main()
    assert api.call('get_weathers',path='/locations')[1]['items']==[{'town':'Buea'}]
    assert api.call('get_weather',weather_id='legacy')[1]['temperatureC']==21.5
