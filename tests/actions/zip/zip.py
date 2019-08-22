import argparse
import json
import os
import zipfile

parser = argparse.ArgumentParser(
        description='Compress an the content of an input folder under zip format')
# parser.add_argument(
#         '--input-dir',
#         help='The directory containing the files to compress')
# parser.add_argument(
#         '--output-dir',
#         help='The directory containing the resulting file of the compression')

workspace = '/app/files'
input_dir = os.path.join(workspace, 'input')
output_dir = os.path.join(workspace, 'output')

with open(os.path.join(workspace, 'results.json'), 'r') as json_file:
    json_data = json_file.read()

results = json.loads(json_data)

path_to_zip = os.path.join(output_dir, results['output']['name'])
my_zip = zipfile.ZipFile(path_to_zip, 'w')
path_to_folder_to_zip = input_dir

for folder, subfolders, files in os.walk(path_to_folder_to_zip):
    for file in files:
        my_zip.write(os.path.join(folder, file), os.path.relpath(os.path.join(folder, file), path_to_folder_to_zip), compress_type=zipfile.ZIP_DEFLATED)
