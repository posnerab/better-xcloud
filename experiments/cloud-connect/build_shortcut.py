#!/usr/bin/env python3
"""Build an unsigned Safari share-sheet Shortcut from the tested userscript core.

Sign the generated file with Apple's `shortcuts sign` on macOS before sharing.
Generated workflows stay outside the Git checkout.
"""
import argparse
import json
from pathlib import Path
import plistlib
import uuid

HERE = Path(__file__).resolve().parent
NAMESPACE = uuid.UUID('8ebf0bca-e4e7-4439-8e23-e1f8db376dbd')
CHOICES = {
    'enable': 'Enable Cloud Connect',
    'restore': 'Restore previous settings',
    'status': 'Check settings',
}


def identity(name):
    return str(uuid.uuid5(NAMESPACE, name)).upper()


def javascript(mode):
    if mode not in CHOICES:
        raise ValueError('Unknown operation')
    source = (HERE / 'cloud-connect.user.js').read_text(encoding='utf-8')
    start, end = '    const keys = ', '    const panel = '
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError('Userscript structure changed; review Shortcut extraction')
    core = source[source.index(start):source.index(end)]
    if core.count('        location.reload();') != 2:
        raise ValueError('Unexpected reload behavior; review Shortcut completion handling')
    # Navigating before completion can invalidate Shortcuts' Safari page context.
    core = core.replace('        location.reload();', '')
    return """// Xbox Cloud Connect: local settings only; no network calls or token access.
(() => {
  try {
    if (location.origin !== 'https://play.xbox.com' || window.top !== window.self) {
      throw new Error('Open https://play.xbox.com/ in Safari, then run Xbox Cloud Connect from the Share menu.');
    }
""" + core + "\n    const mode = " + json.dumps(mode) + ";\n" + """
    let message;
    if (mode === 'enable') {
      enable();
      message = 'Cloud Connect settings enabled. Return to Safari and reload the page. Open Xbox’s controller icon to connect the Nano. Then use Share → Add to Home Screen to play in the Xbox app.';
    } else if (mode === 'restore') {
      restore();
      message = 'Previous Safari settings restored. Return to Safari and reload. An already installed Home Screen app may have separate settings; its restoration is not verified.';
    } else {
      message = isEnabled(readEntries())
        ? 'Both Cloud Connect switches are enabled in this Safari page. This does not verify a controller connection or an existing Home Screen app’s settings.'
        : 'Cloud Connect switches are not both enabled in this Safari page.';
    }
    completion(message);
  } catch (error) {
    completion('Cloud Connect: ' + (error instanceof Error ? error.message : 'Unable to update settings.'));
  }
})();
"""


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def output_text(action_id):
    return {'Value': {'string': '\ufffc', 'attachmentsByRange': {
        '{0, 1}': {'Type': 'ActionOutput', 'OutputUUID': action_id,
                   'OutputName': 'JavaScript Result'}}},
        'WFSerializationType': 'WFTextTokenString'}


def workflow():
    actions = []

    def add(name, **parameters):
        actions.append({'WFWorkflowActionIdentifier': 'is.workflow.actions.' + name,
                        'WFWorkflowActionParameters': parameters})

    add('comment', WFCommentActionText=(
        'Run from Safari’s Share menu on https://play.xbox.com/. '
        'Enable or restore only the two Cloud Connect settings. No network calls, '
        'passwords or tokens. Return to Safari and reload after changing settings. '
        'The existing userscript and this Shortcut share the same restore record.'))
    group = identity('menu')
    add('choosefrommenu', WFControlFlowMode=0, GroupingIdentifier=group,
        WFMenuPrompt='Xbox Cloud Connect — run from Safari’s Share menu',
        WFMenuItems=list(CHOICES.values()))
    for mode, title in CHOICES.items():
        add('choosefrommenu', WFControlFlowMode=1, GroupingIdentifier=group,
            WFMenuItemTitle=title)
        action_id = identity(mode)
        add('runjavascriptonwebpage', UUID=action_id,
            WFInput=attachment({'Type': 'ExtensionInput'}),
            WFJavaScript=javascript(mode))
        add('showresult', Text=output_text(action_id))
    add('choosefrommenu', WFControlFlowMode=2, GroupingIdentifier=group)
    return {
        'WFWorkflowName': 'Xbox Cloud Connect',
        'WFWorkflowActions': actions,
        'WFWorkflowClientRelease': '6.0',
        'WFWorkflowClientVersion': '1200',
        'WFWorkflowMinimumClientVersion': 900,
        'WFWorkflowIcon': {'WFWorkflowIconStartColor': 1263359487,
                           'WFWorkflowIconGlyphNumber': 61440},
        'WFWorkflowImportQuestions': [],
        'WFWorkflowInputContentItemClasses': ['WFSafariWebPageContentItem'],
        'WFWorkflowOutputContentItemClasses': [],
        'WFWorkflowTypes': ['ActionExtension'],
        'WFQuickActionSurfaces': [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output_directory', type=Path)
    args = parser.parse_args()
    args.output_directory.mkdir(parents=True, exist_ok=True)
    result = workflow()
    path = args.output_directory / 'Xbox Cloud Connect.unsigned.shortcut'
    path.write_bytes(plistlib.dumps(result, fmt=plistlib.FMT_BINARY))
    (args.output_directory / 'workflow.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    for mode in CHOICES:
        (args.output_directory / (mode + '.js')).write_text(javascript(mode), encoding='utf-8', newline='\n')
    print(f'Built {len(result["WFWorkflowActions"])} actions: {path}')


if __name__ == '__main__':
    main()
