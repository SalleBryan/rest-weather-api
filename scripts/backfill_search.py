"""One-time, resumable search-index migration. Runtime queries never scan.

After both GSIs are ACTIVE:
    uv run python scripts/backfill_search.py --table TABLE --region us-east-1 --backup PRIVATE_FILE
Keep the backup outside the repository. Business fields are never overwritten.
"""
import argparse
import json
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.types import TypeSerializer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'src'))
from search_index import index_fields, catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--table', required=True)
    parser.add_argument('--region', required=True)
    parser.add_argument('--backup', required=True)
    parser.add_argument('--no-catalog', action='store_true', help='Index readings only, while the old API is still serving')
    args = parser.parse_args()
    table = boto3.resource('dynamodb',region_name=args.region).Table(args.table)
    backup = Path(args.backup)
    backup.parent.mkdir(parents=True, exist_ok=True)
    # Never overwrite a prior migration backup.
    with backup.open('x',encoding='utf-8') as output:
        cursor = None; updated = conflicts = 0
        while True:
            page = table.scan(Limit=100,ConsistentRead=True,**({'ExclusiveStartKey':cursor} if cursor else {}))
            for item in page.get('Items',[]):
                if 'weather' not in item or not isinstance(item.get('town'),str): continue
                output.write(json.dumps({k:TypeSerializer().serialize(v) for k,v in item.items()})+'\n'); output.flush()
                fields = index_fields(item)
                values = {':'+key:value for key,value in fields.items()}
                condition = 'attribute_exists(id) AND attribute_not_exists(revision)'
                if item.get('revision'):
                    values[':revision'] = item['revision']
                    condition = 'attribute_exists(id) AND revision = :revision'
                elif item.get('updatedAt'):
                    values[':updatedAt'] = item['updatedAt']
                    condition += ' AND updatedAt = :updatedAt'
                try:
                    table.update_item(Key={'id':item['id']},ConditionExpression=condition,
                        UpdateExpression='SET feedKey=:feedKey, townKey=:townKey, orderKey=:orderKey',ExpressionAttributeValues=values)
                    if not args.no_catalog: catalog(table,item['town'])
                    updated += 1
                except ClientError as error:
                    if error.response['Error']['Code'] != 'ConditionalCheckFailedException': raise
                    conflicts += 1
            cursor = page.get('LastEvaluatedKey')
            if not cursor: break
    print(f'Indexed {updated} readings; {conflicts} concurrent edits skipped. Backup: {backup}')
    if conflicts: sys.exit(1)


if __name__ == '__main__': main()
